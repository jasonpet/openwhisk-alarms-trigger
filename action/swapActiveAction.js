var redis = require('redis');
var URL = require('url').URL;

function main(params) {

    if (!params.redisUrl && !params.redisUrlBinding) {
        return sendError(400, 'no redisUrl parameter was provided');
    }
    if (!params.redisKeyPrefix) {
        return sendError(400, 'no redisKeyPrefix parameter was provided');
    }
    if (params.kind !== 'alarm' && params.kind !== 'cloudant') {
        return sendError(400, 'kind parameter must be alarm or cloudant');
    }

    var redisUrl = params.redisUrl || params.redisUrlBinding;
    var kind = params.kind;
    var worker = params.worker || 'worker0';
    var redisKeySuffix = kind === 'alarm' ? `alarmservice_${worker}` : `cloudanttrigger_${worker}`;
    var redisKey = params.redisKeyPrefix + redisKeySuffix;
    var redisClient;

    return new Promise(function (resolve, reject) {
        createRedisClient(redisUrl)
        .then(client => {
            redisClient = client;
            return findActiveHost(client, redisKey);
        })
        .then(activeHost => {
            var hostPrefix = activeHost.replace(/\d+$/, '');
            var newActiveHost = activeHost === `${hostPrefix}0` ? `${hostPrefix}1` : `${hostPrefix}0`;

            return setActiveHost(redisClient, redisKey, newActiveHost);
        })
        .then(() => {
            resolve({
                statusCode: 200,
                headers: {'Content-Type': 'application/json'},
                body: new Buffer(JSON.stringify({'status': 'success'})).toString('base64')
            });
        })
        .catch(err => {
            reject(err);
        });
    });


}

function createRedisClient(redisUrl) {
    return new Promise(function(resolve, reject) {
        var client;
        if (redisUrl.startsWith('rediss://')) {
            // If this is a rediss: connection, we have some other steps.
            client = redis.createClient(redisUrl, {
                tls: { servername: new URL(redisUrl).hostname }
            });
            // This will, with node-redis 2.8, emit an error:
            // "node_redis: WARNING: You passed "rediss" as protocol instead of the "redis" protocol!"
            // This is a bogus message and should be fixed in a later release of the package.
        } else {
            client = redis.createClient(redisUrl);
        }
        client.on('connect', function () {
            resolve(client);
        });

        client.on('error', function (err) {
            reject(sendError(400, 'unable to connect to redis'));
        });
    });
}

function findActiveHost(redisClient, redisKey) {

    return new Promise(function(resolve, reject) {
        console.log('find the active host');

        redisClient.hget(redisKey, 'active', function (err, reply) {
            if (!err) {
                resolve(reply);
            }
            else {
                reject(sendError(400, 'unable to get active host in redis'));
            }
        });

    });
}

function setActiveHost(redisClient, redisKey, newActiveHost) {
    return new Promise(function(resolve, reject) {
        console.log('set active host to ' + newActiveHost);
        redisClient.hset(redisKey, 'active', newActiveHost, function (err) {
            if (!err) {
                console.log('publish active host');
                redisClient.publish(redisKey, newActiveHost);
                resolve();
            }
            else {
                reject(sendError(400, 'unable to update active host in redis'));
            }
        });
    });
}

function sendError(statusCode, error, message) {
    var params = {error: error};
    if (message) {
        params.message = message;
    }

    return {
        statusCode: statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: new Buffer(JSON.stringify(params)).toString('base64')
    };
}

exports.main = main;
