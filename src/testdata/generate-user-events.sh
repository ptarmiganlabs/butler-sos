#!/bin/bash

# This script generates randomised user events

# x = number of users, controlled by variable below
userCount=10
# Loop that add users to array 
for ((i=1; i<=userCount; i++)); do
    users[i]="user$i"
done

# Show user array
echo Users:
echo ${users[@]}

# Array of user agents
userAgents=(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:58.0) Gecko/20100101 Firefox/58.0"
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3"
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/604.3.5 (KHTML, like Gecko) Version/11.0.1 Safari/604.3.5"
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36 OPR/45.0.2552.888"
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36 Edge/16.16299"
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; Trident/7.0; rv:11.0) like Gecko"
    "Opera/9.80 (J2ME/MIDP; Opera Mini/4.2.14912/870; U; en) Presto/2.4.15"
    "Mozilla/5.0 (Linux; U; Android 4.2.2; en-US; GT-S7582 Build/JDQ39) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 UCBrowser/11.3.5.972 Mobile Safari/534.30"
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1"
    "Mozilla/5.0 (Linux; Android 7.0; SM-G892A Build/NRD90M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/60.0.3112.107 Mobile Safari/537.36"
    "Mozilla/5.0 (Linux; Android 12; moto g stylus 5G (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36"
)

# Address where UDP server is listening
# address="localhost"
address="192.168.100.110"

# Port where UDP server is listening
port=9997

# UDP message to send has the following format:
# /qseow-proxy-connection/;pro2-win1;Close connection;userdir;<user-id>;AppAccess;/app/a421f4a2-c311-4ef4-ba41-fe2e6a2b0d69?reloaduri=https...;Some text <user-agent>'

# Loop that generates randomised user events
for ((i=1; i<=userCount; i++)); do
    # Get random user
    user=${users[$RANDOM % ${#users[@]} ]}

    # Get random user agent
    userAgent=${userAgents[$RANDOM % ${#userAgents[@]} ]}

    # Debug
    echo User: $user
    echo User agent: $userAgent

    # Combine into "Close connection" UDP message
    message="/qseow-proxy-connection/;pro2-win1;Close connection;userdir;$user;AppAccess;/app/a421f4a2-c311-4ef4-ba41-fe2e6a2b0d69?reloaduri=https...;Some text UserAgent: '$userAgent'"

    # Debug
    echo Message: $message

    # Send UDP message
    echo $message | nc -u -w0 $address $port
done
