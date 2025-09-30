# VOTP Kubernetes Deployment Guide

This directory contains Kubernetes manifests for deploying the Voice of the People (VOTP) platform in a production environment.

## Architecture Overview

The Kubernetes deployment includes:

- **PostgreSQL Master**: Primary database instance with read/write capabilities
- **PostgreSQL Shards**: Two slave instances for read scaling and data distribution
- **Redis**: Caching layer for sessions and temporary data
- **VOTP Backend**: Rust application serving the GraphQL API
- **Ingress**: NGINX ingress controller for external access
- **Auto-scaling**: Horizontal Pod Autoscaler for the backend
- **Network Security**: Network policies for secure communication

## Prerequisites

Before deploying, ensure you have:

1. **Kubernetes Cluster**: Version 1.20+ with at least:
   - 4 vCPUs
   - 8GB RAM
   - 100GB storage
   - LoadBalancer support

2. **kubectl**: Configured to access your cluster

3. **NGINX Ingress Controller**: Installed in your cluster
   ```bash
   kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
   ```

4. **Cert-Manager** (for SSL certificates):
   ```bash
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
   ```

5. **Docker Registry Access**: For the VOTP backend image

## Pre-Deployment Setup

### 1. Build and Push Backend Image

```bash
# Build the Docker image
cd backend
docker build -t your-registry/votp-backend:latest .

# Push to your registry
docker push your-registry/votp-backend:latest
```

### 2. Update Configuration

Edit `votp-deployment.yaml` and update:

- **Image name**: Change `votp-backend:latest` to your actual image
- **Domain**: Change `api.votp.com` to your domain
- **Secrets**: Update all passwords and secrets in the Secret manifest
- **Storage**: Adjust storage sizes based on your needs
- **Resources**: Modify CPU/memory limits based on your cluster capacity

### 3. Configure SSL Certificate

Create a ClusterIssuer for Let's Encrypt:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

## Deployment Steps

### 1. Create Namespace and Apply Manifests

```bash
# Apply all manifests
kubectl apply -f votp-deployment.yaml

# Wait for cert-manager ClusterIssuer
kubectl apply -f cluster-issuer.yaml
```

### 2. Verify Deployment

```bash
# Check namespace
kubectl get namespace votp

# Check all resources
kubectl get all -n votp

# Check persistent volumes
kubectl get pv,pvc -n votp

# Check ingress
kubectl get ingress -n votp
```

### 3. Monitor Pod Status

```bash
# Watch pods starting up
kubectl get pods -n votp -w

# Check logs if needed
kubectl logs -n votp deployment/votp-backend
kubectl logs -n votp statefulset/postgres-master
```

### 4. Test the Deployment

```bash
# Port forward to test locally (optional)
kubectl port-forward -n votp service/votp-backend-service 8000:8000

# Test GraphQL playground
curl http://localhost:8000/playground

# Test via ingress (replace with your domain)
curl https://api.votp.com/playground
```

## Configuration Management

### Environment Variables

The deployment uses ConfigMaps and Secrets:

- **ConfigMap `votp-config`**: Non-sensitive configuration
- **Secret `votp-secrets`**: Sensitive data (passwords, tokens)

### Updating Configuration

```bash
# Edit ConfigMap
kubectl edit configmap votp-config -n votp

# Edit Secrets
kubectl edit secret votp-secrets -n votp

# Restart deployment to pick up changes
kubectl rollout restart deployment/votp-backend -n votp
```

## Scaling

### Manual Scaling

```bash
# Scale backend pods
kubectl scale deployment votp-backend -n votp --replicas=5

# Scale database (careful with stateful sets)
kubectl scale statefulset postgres-master -n votp --replicas=1
```

### Auto-scaling

The HorizontalPodAutoscaler is configured to scale based on:
- CPU utilization: 70%
- Memory utilization: 80%
- Min replicas: 3
- Max replicas: 10

View HPA status:
```bash
kubectl get hpa -n votp
kubectl describe hpa votp-backend-hpa -n votp
```

## Monitoring and Observability

### Health Checks

All services include liveness and readiness probes:

```bash
# Check pod health
kubectl describe pod -n votp -l app=votp-backend

# View probe failures
kubectl get events -n votp --field-selector reason=Unhealthy
```

### Logs

```bash
# Backend logs
kubectl logs -n votp -l app=votp-backend -f

# Database logs
kubectl logs -n votp -l app=postgres-master -f

# All logs with timestamps
kubectl logs -n votp -l app=votp-backend --timestamps=true
```

### Metrics (if Prometheus is installed)

The deployment includes resource requests/limits for metrics collection:

```bash
# View resource usage
kubectl top pods -n votp
kubectl top nodes
```

## Backup and Recovery

### Database Backup

```bash
# Create backup job
kubectl create job -n votp backup-$(date +%Y%m%d) \
  --from=cronjob/postgres-backup # (if you create a backup cronjob)

# Manual backup
kubectl exec -n votp postgres-master-0 -- \
  pg_dump -U postgres votp_db > backup-$(date +%Y%m%d).sql
```

### Restore from Backup

```bash
# Copy backup to pod
kubectl cp backup.sql votp/postgres-master-0:/tmp/

# Restore
kubectl exec -n votp postgres-master-0 -- \
  psql -U postgres votp_db < /tmp/backup.sql
```

## Security Considerations

### Network Policies

The deployment includes NetworkPolicy to:
- Allow ingress only from ingress-nginx namespace
- Allow egress to DNS and SMTP servers
- Restrict inter-pod communication

### Pod Security

- Containers run as non-root users
- Security contexts defined
- Resource limits enforced
- Health checks implemented

### Secrets Management

- All sensitive data in Kubernetes Secrets
- TLS certificates managed by cert-manager
- Database passwords rotated regularly

## Troubleshooting

### Common Issues

1. **Pods in Pending State**
   ```bash
   kubectl describe pod -n votp <pod-name>
   # Check for resource constraints or PVC issues
   ```

2. **Database Connection Issues**
   ```bash
   kubectl exec -n votp postgres-master-0 -- pg_isready
   kubectl logs -n votp -l app=votp-backend | grep -i database
   ```

3. **Ingress Issues**
   ```bash
   kubectl describe ingress -n votp votp-backend-ingress
   kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx
   ```

4. **Certificate Issues**
   ```bash
   kubectl describe certificate -n votp
   kubectl describe certificaterequest -n votp
   ```

### Debug Commands

```bash
# Get into a pod for debugging
kubectl exec -n votp -it postgres-master-0 -- /bin/bash

# Check DNS resolution
kubectl exec -n votp -it deployment/votp-backend -- nslookup postgres-master-service

# Test database connectivity
kubectl exec -n votp -it postgres-master-0 -- \
  psql -U postgres -d votp_db -c "SELECT version();"
```

## Maintenance

### Rolling Updates

```bash
# Update backend image
kubectl set image deployment/votp-backend -n votp \
  votp-backend=your-registry/votp-backend:v2.0.0

# Check rollout status
kubectl rollout status deployment/votp-backend -n votp

# Rollback if needed
kubectl rollout undo deployment/votp-backend -n votp
```

### Database Maintenance

```bash
# Check database sizes
kubectl exec -n votp postgres-master-0 -- \
  psql -U postgres -d votp_db -c "\l+"

# Vacuum and analyze
kubectl exec -n votp postgres-master-0 -- \
  psql -U postgres -d votp_db -c "VACUUM ANALYZE;"
```

## Clean Up

To remove the entire deployment:

```bash
# Delete all resources
kubectl delete -f votp-deployment.yaml

# Delete persistent volumes (WARNING: This deletes all data)
kubectl delete pv -l app=postgres-master
kubectl delete pv -l app=postgres-shard-1
kubectl delete pv -l app=postgres-shard-2
kubectl delete pv -l app=redis

# Delete namespace
kubectl delete namespace votp
```

## Production Checklist

Before going to production, ensure:

- [ ] All secrets are properly configured with strong passwords
- [ ] Domain and SSL certificates are working
- [ ] Backup strategy is implemented
- [ ] Monitoring and alerting are configured
- [ ] Resource limits are appropriate for your load
- [ ] Network policies are tested
- [ ] Security scanning is performed on images
- [ ] Load testing is completed
- [ ] Disaster recovery procedures are documented
- [ ] Team has access to troubleshooting documentation

For additional support, refer to the main project documentation or create an issue in the project repository.