#!/bin/bash

. /etc/rc.d/init.d/functions
api_pid=/var/run/watchtv/api_server.pid
judge_pid=/var/run/watchtv/judge.pid
api_lock=/var/lock/subsys/watchtv_api
judge_lock=/var/lock/subsys/watchtv_judge
api_path=/usr/lib/watchtv/api_server.js
judge_path=/usr/lib/watchtv/judge.js
RETVAL=0

start() {
    echo -n "Starting API server: "
	daemon "nohup node $api_path < /dev/null > /dev/null 2>&1 &"
	RETVAL=$?
	ps -ef|grep "node $api_path"|grep -v grep|awk '{ print $2 }' > $api_pid
	echo
        [ $RETVAL = 0 ] && touch ${api_lock}
    echo -n "Starting Judge: "
	daemon "nohup node $judge_path < /dev/null > /dev/null 2>&1 &"
	RETVAL=$?
	ps -ef|grep "node $judge_path"|grep -v grep|awk '{ print $2 }' > $judge_pid
	echo
        [ $RETVAL = 0 ] && touch ${judge_lock}
	return $RETVAL
}

stop() {
	echo -n "Stopping API server: "
	killproc -p ${api_pid} -d 10
	RETVAL=$?
	echo
	[ $RETVAL = 0 ] && rm -f ${api_lock} ${pidfile}

	echo -n "Stopping judge: "
	killproc -p ${judge_pid} -d 10
	RETVAL=$?
	echo
	[ $RETVAL = 0 ] && rm -f ${judge_lock} ${pidfile}
}

case "$1" in
  start)
	start
	;;
  stop)
	stop
	;;
  status)
        status -p ${api_pid} -l ${api_lock} "API server"
        status -p ${judge_pid} -l ${judge_lock} "Judge"
	RETVAL=$?
	;;
  restart)
	stop
	start
	;;
  *)
	echo $"Usage: $prog {start|stop|restart}"
	RETVAL=2
esac

exit $RETVAL
