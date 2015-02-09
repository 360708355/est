var path = require('path');
var injector = null;

module.exports = {
    install: function (less, pluginManager) {
        var injector = this.getInstance(less);
        pluginManager.addPreProcessor(injector);
    },
    getInstance: function (less) {
        if (!injector) {
            var FileManager = less.FileManager;

            function Injector(options) {
                this.options = options || {};
            }

            Injector.prototype.process = function (src, extra) {
                var injected = '@import "all.less";\n';
                var ignored = extra.imports.contentsIgnoredChars;
                var fileInfo = extra.fileInfo;
                ignored[fileInfo.filename] = ignored[fileInfo.filename] || 0;
                ignored[fileInfo.filename] += injected.length;
                extra.context.paths.push(path.resolve(__dirname, '../src'));
                return injected + src;
            };

            injector = new Injector(this.options);
        }
        return injector;
    }
};
