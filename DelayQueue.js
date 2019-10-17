
const addTaskToDelayQueue = (function () {
    const taskQueue = [];
    let task = null;
    let queueisEmpty = true;

    function nextTask() {
        if (task !== null) {
            task.func();
            task = null;
        }
        if (taskQueue.length > 0) {
            task = taskQueue.shift();
            setTimeout(nextTask, task.delay)
        } else {
            queueisEmpty = true;
        }
    }

    return (func, delay) => {
        taskQueue.push({ func: func, delay: delay });

        if (taskQueue.length == 1 && queueisEmpty) {
            queueisEmpty = false;
            setTimeout(nextTask, 0);
        }
    }
})();

module.exports = addTaskToDelayQueue;