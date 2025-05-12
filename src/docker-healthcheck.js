// Set up REST endpoint for Docker healthchecks
import httpHealth from 'http';

// TODO: Consider moving these options to a configuration file for better maintainability
const optionsHealth = {
    host: 'localhost',
    port: '12398',
    path: '/health',
    timeout: 2000,
};

/**
 * Creates and executes an HTTP request to check if the application is healthy.
 * Used for Docker health checks to determine container health status.
 * Exits with code 0 if health check succeeds, 1 otherwise.
 */
const requestHealth = httpHealth.request(optionsHealth, (res) => {
    console.log(`STATUS Docker health: ${res.statusCode}`);
    if (res.statusCode === 200) {
        process.exit(0);
    } else {
        process.exit(1);
    }
});

/**
 * Error handler for health check request.
 * Logs the error and exits with code 1 to indicate failure.
 */
requestHealth.on('error', (err) => {
    console.log('ERROR Docker health:');
    console.log(err);
    process.exit(1);
});

requestHealth.end();
