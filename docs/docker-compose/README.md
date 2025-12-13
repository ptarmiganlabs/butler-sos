# Docker Compose Files for Butler SOS with InfluxDB

This directory contains Docker Compose configurations for running Butler SOS with different versions of InfluxDB.

## Available Configurations

### InfluxDB v1.x

- **File**: `docker-compose_fullstack_influxdb_v1.yml`
- **InfluxDB Image**: `influxdb:1.8-alpine`
- **Features**: Traditional InfluxDB with SQL-like query language
- **Configuration**: Set `Butler-SOS.influxdbConfig.version: 1` in your config file
- **Environment**: Set `NODE_ENV=production_influxdb_v1`

### InfluxDB v2.x

- **File**: `docker-compose_fullstack_influxdb_v2.yml`
- **InfluxDB Image**: `influxdb:2.7-alpine`
- **Features**: Modern InfluxDB with Flux query language, unified time series platform
- **Configuration**: Set `Butler-SOS.influxdbConfig.version: 2` in your config file
- **Environment**: Set `NODE_ENV=production_influxdb_v2`
- **Default Credentials**:
    - Username: `admin`
    - Password: `butlersos123`
    - Organization: `butler-sos`
    - Bucket: `butler-sos`
    - Token: `butlersos-token`

### InfluxDB v3.x

- **File**: `docker-compose_fullstack_influxdb_v3.yml`
- **InfluxDB Image**: `influxdb:latest`
- **Features**: Latest InfluxDB architecture with enhanced performance and cloud-native design
- **Configuration**: Set `Butler-SOS.influxdbConfig.version: 3` in your config file
- **Environment**: Set `NODE_ENV=production_influxdb_v3`
- **Default Credentials**: Same as v2.x but with database concept support

## Usage

1. Choose the appropriate docker-compose file for your InfluxDB version
2. Create the corresponding configuration file (e.g., `production_influxdb_v2.yaml`)
3. Configure Butler SOS with the correct InfluxDB version and connection details
4. Run with: `docker-compose -f docker-compose_fullstack_influxdb_v2.yml up -d`

## Configuration Requirements

### For InfluxDB v1.x

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

### For InfluxDB v2.x

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

### For InfluxDB v3.x

```yaml
Butler-SOS:
    influxdbConfig:
        enable: true
        version: 3
        host: influxdb-v3
        port: 8086
        v3Config:
            database: butler-sos
            token: butlersos-token
            description: Butler SOS metrics
            retentionDuration: 10d
```

## Migration Notes

- **v1 to v2**: Requires data migration using InfluxDB tools
- **v2 to v3**: Uses similar client libraries but different internal architecture
- **v1 to v3**: Significant migration required, consider using InfluxDB migration tools

For detailed configuration options, refer to the main Butler SOS documentation.
