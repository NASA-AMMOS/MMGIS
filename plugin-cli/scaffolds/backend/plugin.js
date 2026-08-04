const router = require('./routes/__name__')

let setup = {
    onceInit: (s) => {
        s.app.use(
            s.ROOT_PATH + '/api/__name__',
            s.checkHeadersCodeInjection,
            s.setContentType,
            router
        )
    },
    onceStarted: (s) => {},
    onceSynced: (s) => {},
}

module.exports = setup
