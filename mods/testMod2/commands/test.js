module.exports = {
    name: 'ping',
    description: 'This command is used to ping the server for a response time!',
    exclusive: true,
    priority: 0,
    execute(playerObj, args) {
        console.log('Pong.');
    },
};