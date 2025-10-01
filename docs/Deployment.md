# VOTP Deployment Guide

This guide covers production deployment of the Voice of the People (VOTP) platform using Kubernetes and Docker.

## Deployment Architecture Overview

```mermaid
architecture-beta
    group internet(cloud)[Internet]
    group k8s(cloud)[Kubernetes Cluster]
    group data(database)[Data Layer]
    group monitoring(server)[Monitoring]

    service lb(internet)[Load Balancer] in internet
    service ingress[Ingress Controller] in k8s
    service api[VOTP API Pods] in k8s
    service postgres(database)[PostgreSQL] in data
    service redis(database)[Redis] in data
    service prometheus(server)[Prometheus] in monitoring
    service grafana(server)[Grafana] in monitoring

    lb:R -- L:ingress
    ingress:B -- T:api
    api:B -- T:postgres
    api:B -- T:redis
    api:R -- L:prometheus
    prometheus:R -- L:grafana
```

## Prerequisites

### Infrastructure Requirements
- **Kubernetes Cluster**: v1.24+ with at least 3 worker nodes
- **Node Specifications**: 4 CPU cores, 8GB RAM minimum per node
- **Storage**: Persistent volume support (100GB+ for database)
- **Network**: Load balancer with public IP access
- **SSL/TLS**: Certificate management (Let's Encrypt recommended)

### Required Tools
```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Install Docker (for image building)
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

## Deployment Process

### 1. Environment Setup

Create production environment configuration:

```bash
# Create namespace
kubectl create namespace votp-production

# Create configuration files
mkdir -p k8s/production
cd k8s/production
```

### 2. Database Deployment

Deploy PostgreSQL with persistence:

```yaml
# postgres-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-config
  namespace: votp-production
data:
  POSTGRES_DB: votp_db
  POSTGRES_USER: votp_user
  PGDATA: /var/lib/postgresql/data/pgdata
---
# postgres-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: postgres-secret
  namespace: votp-production
type: Opaque
data:
  POSTGRES_PASSWORD: <base64-encoded-password>
---
# postgres-pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: votp-production
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
  storageClassName: fast-ssd
---
# postgres-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: votp-production
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
        envFrom:
        - configMapRef:
            name: postgres-config
        - secretRef:
            name: postgres-secret
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - votp_user
            - -d
            - votp_db
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - votp_user
            - -d
            - votp_db
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
# postgres-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: votp-production
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
  type: ClusterIP
```

### 3. Redis Deployment

Deploy Redis for caching:

```yaml
# redis-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: votp-production
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        command:
        - redis-server
        - --requirepass
        - $(REDIS_PASSWORD)
        env:
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: password
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          tcpSocket:
            port: 6379
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 5
          periodSeconds: 5
---
# redis-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: redis-secret
  namespace: votp-production
type: Opaque
data:
  password: <base64-encoded-redis-password>
---
# redis-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: redis-service
  namespace: votp-production
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
  type: ClusterIP
```

### 4. Application Deployment

Build and deploy the VOTP API:

```bash
# Build Docker image
docker build -t votp-api:latest -f backend/Dockerfile backend/
docker tag votp-api:latest your-registry.com/votp-api:v1.0.0
docker push your-registry.com/votp-api:v1.0.0
```

```yaml
# votp-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: votp-config
  namespace: votp-production
data:
  DATABASE_URL: "postgresql://votp_user:password@postgres-service:5432/votp_db"
  REDIS_URL: "redis://:password@redis-service:6379"
  HOST: "0.0.0.0"
  PORT: "8000"
  RUST_LOG: "info"
  SMTP_HOST: "smtp.gmail.com"
  SMTP_PORT: "587"
  SMTP_USERNAME: "your-email@gmail.com"
---
# votp-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: votp-secret
  namespace: votp-production
type: Opaque
data:
  JWT_SECRET: <base64-encoded-jwt-secret>
  SMTP_PASSWORD: <base64-encoded-smtp-password>
  DATABASE_PASSWORD: <base64-encoded-db-password>
  REDIS_PASSWORD: <base64-encoded-redis-password>
---
# votp-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: votp-api
  namespace: votp-production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: votp-api
  template:
    metadata:
      labels:
        app: votp-api
    spec:
      containers:
      - name: votp-api
        image: your-registry.com/votp-api:v1.0.0
        ports:
        - containerPort: 8000
        envFrom:
        - configMapRef:
            name: votp-config
        - secretRef:
            name: votp-secret
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /playground
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /playground
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
---
# votp-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: votp-api-service
  namespace: votp-production
spec:
  selector:
    app: votp-api
  ports:
  - port: 80
    targetPort: 8000
  type: ClusterIP
```

### 5. Ingress Configuration

Configure external access with SSL:

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: votp-ingress
  namespace: votp-production
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/cors-allow-origin: "*"
    nginx.ingress.kubernetes.io/cors-allow-methods: "GET, POST, OPTIONS"
    nginx.ingress.kubernetes.io/cors-allow-headers: "Content-Type, Authorization"
spec:
  tls:
  - hosts:
    - api.votp.example.com
    secretName: votp-tls
  rules:
  - host: api.votp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: votp-api-service
            port:
              number: 80
```

### 6. Monitoring Setup

Deploy Prometheus and Grafana:

```bash
# Add Helm repositories
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install Prometheus
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace votp-production \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false

# Install Grafana
helm install grafana grafana/grafana \
  --namespace votp-production \
  --set adminPassword=admin123 \
  --set service.type=LoadBalancer
```

## Deployment Commands

Execute the deployment in order:

```bash
# 1. Apply database components
kubectl apply -f postgres-configmap.yaml
kubectl apply -f postgres-secret.yaml
kubectl apply -f postgres-pvc.yaml
kubectl apply -f postgres-deployment.yaml
kubectl apply -f postgres-service.yaml

# 2. Apply Redis components
kubectl apply -f redis-secret.yaml
kubectl apply -f redis-deployment.yaml
kubectl apply -f redis-service.yaml

# 3. Wait for databases to be ready
kubectl wait --for=condition=available --timeout=300s deployment/postgres -n votp-production
kubectl wait --for=condition=available --timeout=300s deployment/redis -n votp-production

# 4. Apply application components
kubectl apply -f votp-configmap.yaml
kubectl apply -f votp-secret.yaml
kubectl apply -f votp-deployment.yaml
kubectl apply -f votp-service.yaml

# 5. Apply ingress
kubectl apply -f ingress.yaml

# 6. Verify deployment
kubectl get pods -n votp-production
kubectl get services -n votp-production
kubectl get ingress -n votp-production
```

## Database Migration

Run database migrations after deployment:

```bash
# Create migration job
kubectl create job votp-migrate \
  --image=your-registry.com/votp-api:v1.0.0 \
  --namespace=votp-production \
  -- /bin/sh -c "sqlx migrate run"

# Monitor migration
kubectl logs job/votp-migrate -n votp-production
```

## Health Checks

Verify deployment health:

```bash
# Check pod status
kubectl get pods -n votp-production

# Check service endpoints
kubectl get endpoints -n votp-production

# Test API connectivity
curl -k https://api.votp.example.com/playground

# Check logs
kubectl logs deployment/votp-api -n votp-production
```

## Scaling Operations

### Horizontal Pod Autoscaler

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: votp-api-hpa
  namespace: votp-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: votp-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Manual Scaling

```bash
# Scale API pods
kubectl scale deployment votp-api --replicas=5 -n votp-production

# Scale database (if using StatefulSet)
kubectl scale statefulset postgres --replicas=3 -n votp-production
```

## Backup and Recovery

### Database Backup

```bash
# Create backup job
kubectl create job postgres-backup-$(date +%Y%m%d) \
  --image=postgres:15-alpine \
  --namespace=votp-production \
  -- /bin/sh -c "pg_dump -h postgres-service -U votp_user votp_db > /backup/votp_$(date +%Y%m%d_%H%M%S).sql"

# Verify backup
kubectl logs job/postgres-backup-$(date +%Y%m%d) -n votp-production
```

### Automated Backup CronJob

```yaml
# backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: votp-production
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: postgres-backup
            image: postgres:15-alpine
            command:
            - /bin/sh
            - -c
            - |
              pg_dump -h postgres-service -U votp_user votp_db | \
              gzip > /backup/votp_$(date +%Y%m%d_%H%M%S).sql.gz
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: POSTGRES_PASSWORD
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: backup-pvc
          restartPolicy: OnFailure
```

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Application Metrics**:
   - Request rate and latency
   - Error rates by endpoint
   - Active user sessions
   - Comment creation rate

2. **Infrastructure Metrics**:
   - CPU and memory usage
   - Database connections
   - Redis cache hit ratio
   - Network I/O

3. **Business Metrics**:
   - Daily active users
   - Comments per page
   - User registration rate
   - Email delivery success

### Grafana Dashboard

Import the VOTP dashboard configuration:

```json
{
  "dashboard": {
    "title": "VOTP Production Dashboard",
    "panels": [
      {
        "title": "API Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{ method }} {{ path }}"
          }
        ]
      },
      {
        "title": "Database Connections",
        "type": "singlestat",
        "targets": [
          {
            "expr": "pg_stat_database_numbackends",
            "legendFormat": "Active Connections"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "container_memory_usage_bytes{pod=~\"votp-api.*\"}",
            "legendFormat": "{{ pod }}"
          }
        ]
      }
    ]
  }
}
```

## Security Configuration

### Network Policies

```yaml
# network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: votp-network-policy
  namespace: votp-production
spec:
  podSelector:
    matchLabels:
      app: votp-api
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 8000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
```

### Pod Security Standards

```yaml
# pod-security-policy.yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: votp-psp
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
```

## Troubleshooting

### Common Issues

1. **Pod CrashLoopBackOff**:
   ```bash
   kubectl describe pod <pod-name> -n votp-production
   kubectl logs <pod-name> -n votp-production --previous
   ```

2. **Database Connection Issues**:
   ```bash
   kubectl exec -it deployment/votp-api -n votp-production -- \
     psql -h postgres-service -U votp_user -d votp_db
   ```

3. **SSL Certificate Problems**:
   ```bash
   kubectl describe certificate votp-tls -n votp-production
   kubectl describe certificaterequest -n votp-production
   ```

### Performance Optimization

1. **Database Query Optimization**:
   - Enable query logging
   - Use connection pooling
   - Implement read replicas

2. **API Response Caching**:
   - Configure Redis caching
   - Implement GraphQL query caching
   - Use CDN for static assets

3. **Resource Limits**:
   - Adjust CPU/memory limits based on metrics
   - Configure appropriate JVM heap sizes
   - Monitor garbage collection

## Maintenance

### Regular Maintenance Tasks

1. **Weekly**:
   - Review error logs
   - Check backup integrity
   - Monitor resource usage

2. **Monthly**:
   - Update container images
   - Review security patches
   - Analyze performance metrics

3. **Quarterly**:
   - Review scaling policies
   - Update SSL certificates
   - Perform disaster recovery tests

### Update Process

```bash
# Rolling update
kubectl set image deployment/votp-api \
  votp-api=your-registry.com/votp-api:v1.1.0 \
  -n votp-production

# Monitor rollout
kubectl rollout status deployment/votp-api -n votp-production

# Rollback if needed
kubectl rollout undo deployment/votp-api -n votp-production
```

---

*This deployment guide provides a production-ready setup for the VOTP platform. Adjust configurations based on your specific requirements and infrastructure.*