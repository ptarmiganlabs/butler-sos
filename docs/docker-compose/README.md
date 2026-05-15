# Docker Compose Files for Butler SOS

This directory contains Docker Compose configurations for running Butler SOS with different versions of InfluxDB, as well as a Prometheus/Grafana stack.

## Scope of These Examples

The Docker Compose stacks in this folder are focused on running Butler SOS with metrics storage and the surrounding time-series stack.

The sample YAML files under `config/` intentionally do **not** include `Butler-SOS.auditEvents` sections. They are metrics-oriented starter configs for the Compose stacks, not complete audit-events examples. This keeps the Docker samples small and avoids mixing browser audit API settings, screenshot storage paths, QPS ticket authentication, and deployment-specific certificate choices into the generic Compose templates.

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

### InfluxDB v2.x

- **File**: `docker-compose_fullstack_influxdb_v2.yml`
- **InfluxDB Image**: `influxdb:2.7-alpine`
- **Features**: Modern InfluxDB with Flux query language, unified time series platform
- **Configuration (metrics)**: Set `Butler-SOS.influxdbConfig.version: 2` in your config file
- **Default Credentials**: username `admin`, password `butlersos123`, organization `butler-sos`, bucket `butler-sos`, token `butlersos-token`

### InfluxDB v3.x

- **File**: `docker-compose_fullstack_influxdb_v3.yml`
- **InfluxDB Image**: `influxdb:3-core`
- **Features**: InfluxDB v3 Core (Community Edition)
- **Configuration (metrics)**: Set `Butler-SOS.influxdbConfig.version: 3` in your config file
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

These examples are version-specific metrics snippets for `Butler-SOS.influxdbConfig`. The sample config files intentionally omit audit-events settings. If you need audit events in a Docker Compose deployment, start from one of these metrics configs, then copy the relevant `Butler-SOS.auditEvents` block from the main config template into your deployment-specific config file.

### Metrics Config: InfluxDB v1.x

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

### Metrics Config: InfluxDB v2.x

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

### Metrics Config: InfluxDB v3.x

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

For detailed configuration options, refer to the main [Butler SOS documentation](https://butler-sos.ptarmiganlabs.com).
