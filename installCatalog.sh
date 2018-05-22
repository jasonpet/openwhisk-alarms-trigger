#!/bin/bash
#
# use the command line interface to install standard actions deployed
# automatically
#
# To run this command
# ./installCatalog.sh <authkey> <apihost> <redisURL>

set -e
set -x

: ${OPENWHISK_HOME:?"OPENWHISK_HOME must be set and non-empty"}
WSK_CLI="$OPENWHISK_HOME/bin/wsk"

if [ $# -eq 0 ]; then
    echo "Usage: ./installCatalog.sh <authkey> <apihost> <redisURL>"
fi

AUTH="$1"
APIHOST="$2"
REDISURL="$3"

# If the auth key file exists, read the key in the file. Otherwise, take the
# first argument as the key itself.
if [ -f "$AUTH" ]; then
    AUTH=`cat $AUTH`
fi

# Make sure that the APIHOST is not empty.
: ${APIHOST:?"APIHOST must be set and non-empty"}

PACKAGE_HOME="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

export WSK_CONFIG_FILE= # override local property file to avoid namespace clashes

echo Installing providerUtils package.


$WSK_CLI -i --apihost "$APIHOST" package update --auth $AUTH --shared no providerUtils \
    -a description "Provider Utilities " \
    -p redisUrlBinding "$REDISURL"

$WSK_CLI -i --apihost "$APIHOST" action update --kind nodejs:8 --auth "$AUTH" providerUtils/swapActiveProvider "$PACKAGE_HOME/action/swapActiveAction.js" \
    -a description "Utility to swap active provider" \
    -a parameters '[ {"name":"redisUrl", "required":false}, {"name":"redisKeyPrefix", "required":true}, {"name":"kind", "required":true} ]' \
    --web true





