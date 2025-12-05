# Performance Testing

Load testing scripts using k6.

## Prerequisites

```bash
# Install k6
# macOS
brew install k6

# Windows
choco install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

## Running Tests

### Basic Load Test
```bash
k6 run load-test.js
```

### With Custom Base URL
```bash
BASE_URL=https://your-app.com k6 run load-test.js
```

### Stress Test (High Load)
```bash
k6 run load-test.js --tag testType=stress
```

### Output to File
```bash
k6 run --out json=results.json load-test.js
```

### Run with Cloud
```bash
k6 cloud load-test.js
```

## Test Scenarios

### 1. Normal Load Test
- Ramps from 0 to 1000 users over 30 minutes
- Tests sustained load
- Target: 95% requests < 500ms

### 2. Stress Test
- Ramps to 2000+ users
- Finds breaking point
- Identifies bottlenecks

### 3. Spike Test
- Sudden traffic spike (100 → 1400 users)
- Tests auto-scaling
- Ensures system recovers

## Metrics

### Key Metrics to Watch:
- **http_req_duration**: Response time
- **http_req_failed**: Failed requests
- **http_reqs**: Requests per second
- **vus**: Virtual users (concurrent)

### Thresholds:
- 95% of requests must complete in < 500ms
- Error rate must be < 1%
- System must handle 1000 concurrent users

## Results Interpretation

### Good Performance:
```
✓ http_req_duration..........: avg=250ms p(95)=450ms
✓ http_req_failed............: 0.1% 
✓ http_reqs..................: 50000/s
```

### Poor Performance:
```
✗ http_req_duration..........: avg=2s p(95)=5s
✗ http_req_failed............: 5%
✗ http_reqs..................: 100/s
```

## Optimization Tips

If tests fail:
1. **High response times?** → Add caching, optimize queries
2. **High error rate?** → Check rate limiting, increase capacity
3. **Memory issues?** → Optimize memory usage, add limits
4. **Database slow?** → Add indexes, use read replicas

## CI/CD Integration

Add to GitHub Actions:
```yaml
- name: Load Test
  run: |
    npm install -g k6
    k6 run tests/performance/load-test.js
```





