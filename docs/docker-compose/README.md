# Docker Compose Files for Butler SOS

This directory contains Docker Compose configurations for running Butler SOS with different versions of InfluxDB, as well as a Prometheus/Grafana stack.

## Two Separate InfluxDB Config Sections (Metrics vs Audit)

Butler SOS can write **two different kinds of data**, and each has its **own** InfluxDB configuration section:

- **Metrics storage** (regular Butler SOS metrics): `Butler-SOS.influxdbConfig`
- **Audit events storage** (events from the Butler SOS audit extension): `Butler-SOS.auditEvents.destination`

These are intentionally independent so you can store metrics and audit events in different InfluxDB instances/versions/buckets/databases if you want.

Key toggles:

- `Butler-SOS.auditEvents.enable` controls whether the audit events API is enabled.
- `Butler-SOS.auditEvents.destination.enable` controls whether audit events are written to a destination (e.g. InfluxDB).

## Available Configurations

The InfluxDB docker-compose files in this folder start Butler SOS from a **local image**:

- **Butler SOS image**: `butler-sos:local`

Build the image first by running `npm run build:docker` from the main Butler SOS repository folder.

The container is started with an explicit config file under `./config/` (wired into the docker-compose file). When starting a stack you must specify the compose file name (use `-f`, as shown below).

### Prometheus

This folder also contains a Prometheus/Grafana stack:

- **File**: `docker-compose_fullstack_prometheus.yml`
- **Butler SOS image**: `ptarmiganlabs/butler-sos:latest`
- **Prometheus image**: `prom/prometheus:latest`
- **Grafana image**: `grafana/grafana:latest`

### InfluxDB v1.x

- **File**: `docker-compose_fullstack_influxdb_v1.yml`
- **InfluxDB Image**: `influxdb:1.12.2`
- **Features**: First generation InfluxDB with SQL-like query language (but not strictly SQL)
- **Configuration (metrics)**: Set `Butler-SOS.influxdbConfig.version: 1` in your config file
- **Configuration (audit events, optional)**: Set `Butler-SOS.auditEvents.destination.influxdb.version: 1` if you want to store audit events in InfluxDB v1

### InfluxDB v2.x

- **File**: `docker-compose_fullstack_influxdb_v2.yml`
- **InfluxDB Image**: `influxdb:2.7-alpine`
- **Features**: Modern InfluxDB with Flux query language, unified time series platform
- **Configuration (metrics)**: Set `Butler-SOS.influxdbConfig.version: 2` in your config file
- **Configuration (audit events, optional)**: Set `Butler-SOS.auditEvents.destination.influxdb.version: 2` if you want to store audit events in InfluxDB v2
- **Default Credentials**:
    - Username: `admin`
    - Password: `butlersos123`
    - Organization: `butler-sos`
    - Bucket: `butler-sos`
    - Token: `butlersos-token`

### InfluxDB v3.x

- **File**: `docker-compose_fullstack_influxdb_v3.yml`
- **InfluxDB Image**: `influxdb:3-core`
- **Features**: InfluxDB v3 Core (Community Edition)
- **Configuration (metrics)**: Set `Butler-SOS.influxdbConfig.version: 3` in your config file
- **Configuration (audit events, optional)**: Set `Butler-SOS.auditEvents.destination.influxdb.version: 3` if you want to store audit events in InfluxDB v3
- **Environment**: Uses `.env` in this folder (for example `INFLUXDB_HTTP_PORT`, `INFLUXDB_TOKEN`, `INFLUXDB_DATABASE`, `BUTLER_SOS_CONFIG_FILE`, `GRAFANA_PORT`)

## Usage

Run the commands below from this folder (`docs/docker-compose/`).

### InfluxDB v1 stack

```bash
docker compose -f docker-compose_fullstack_influxdb_v1.yml up -d
```

### InfluxDB v2 stack

```bash
docker compose -f docker-compose_fullstack_influxdb_v2.yml up -d
```

### InfluxDB v3 stack

This stack uses the variables in `.env` (Docker Compose will read it automatically when run from this folder).

```bash
docker compose --env-file .env -f docker-compose_fullstack_influxdb_v3.yml up -d
```

### Prometheus/Grafana stack

```bash
docker compose -f docker-compose_fullstack_prometheus.yml up -d
```

## Configuration Requirements

The docker-compose stacks in this folder include sample YAML config files under `config/`.

The examples below are version-specific, and show both:

- **Metrics**: `Butler-SOS.influxdbConfig`
- **Audit events**: `Butler-SOS.auditEvents.destination`

### InfluxDB v1.x

**Metrics storage (InfluxDB v1)**

```yaml
Butler-SOS:
    influxdbConfig:
        enable: true
        version: 1
        host: influxdb-v1
        port: 8086
        v1Config:
            auth:
                enable: false
            dbName: SenseOps
            retentionPolicy:
                name: 10d
                duration: 10d
```

**Audit events storage (InfluxDB v1)**

```yaml
Butler-SOS:
    auditEvents:
        enable: false
        destination:
            enable: false
            type: influxdb
            influxdb:
                host: influxdb-v1
                port: 8086
                version: 1
                v1Config:
                    auth:
                        enable: false
                    dbName: SenseOpsAudit
                    retentionPolicy:
                        name: 10d
                        duration: 10d
```

### InfluxDB v2.x

**Metrics storage (InfluxDB v2)**

```yaml
Butler-SOS:
    influxdbConfig:
        enable: true
        version: 2
        host: influxdb-v2
        port: 8086
        v2Config:
            org: butler-sos
            bucket: butler-sos
            token: butlersos-token
            description: Butler SOS metrics
            retentionDuration: 10d
```

**Audit events storage (InfluxDB v2)**

```yaml
Butler-SOS:
    auditEvents:
        enable: false
        destination:
            enable: false
            type: influxdb
            influxdb:
                host: influxdb-v2
                port: 8086
                version: 2
                v2Config:
                    org: butler-sos
                    bucket: butler-sos-audit
                    token: butlersos-token
```

### InfluxDB v3.x

**Metrics storage (InfluxDB v3)**

```yaml
Butler-SOS:
    influxdbConfig:
        enable: true
        version: 3
        host: influxdb-v3-core
        port: 8181
        v3Config:
            database: butler-sos
            token: butlersos-token
            description: Butler SOS metrics
            retentionDuration: 10d
```

**Audit events storage (InfluxDB v3)**

```yaml
Butler-SOS:
    auditEvents:
        enable: false
        destination:
            enable: false
            type: influxdb
            influxdb:
                host: influxdb-v3-core
                port: 8181
                version: 3
                v3Config:
                    database: butler-sos-audit
                    token: butlersos-token
```

For detailed configuration options, refer to the main [Butler SOS documentation](https://butler-sos.ptarmiganlabs.com).
