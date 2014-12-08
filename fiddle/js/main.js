(function () {
    function $(id) {
        return document.getElementById(id);
    };

    function showCode() {
        document.body.classList.add('ready');
    }

    function hideCode() {
        document.body.classList.remove('ready');
    }

    function showComments() {
        document.body.classList.add('discussing');
    }

    function hideComments() {
        document.body.classList.remove('discussing');
    }

    function showCompiled() {
        document.body.classList.remove('compiling');
    }

    function hideCompiled() {
        document.body.classList.add('compiling');
    }

    function parseQuery(search) {
        var query = {};
        search = search.substring(search.indexOf('?') + 1 || search.indexOf('#') + 1);
        search.split('&').forEach(function (token) {
            var kv = token.split('=').filter(function (s) {
                return !!s.length;
            });
            if (kv.length === 2) {
                query[kv[0]] = decodeURIComponent(kv[1]);
            } else if (kv.length === 1) {
                query[kv[0]] = true;
            }
        });
        return query;
    }

    function stringifyQuery(query) {
        var kvs = [];

        for (var key in query) {
            kvs.push(key + '=' + encodeURIComponent(query[key]));
        }

        return kvs.join('&');
    }

    function saveSetting(key, value, isRewrite) {
        var current = parseQuery(window.location.hash);
        current[key] = value;

        var hash = stringifyQuery(current);
        if (isRewrite !== false) {
            window.location.hash = hash;
        }
        return hash;
    }

    /**
     * Initialize code editors
     */
    var est = CodeMirror.fromTextArea($('est'), {
        mode: 'text/x-less',
        theme: 'monokai',
        indentUnit: 4,
        lineNumbers : true,
        matchBrackets : true
    });

    var css = CodeMirror.fromTextArea($('css'), {
        mode: 'css',
        theme: 'monokai',
        indentUnit: 4,
        lineNumbers : true,
        matchBrackets : true,
        readOnly: true
    });

    /**
     * Initialize Less
     */
    var _LESS_VERSIONS = {};

    function loadScript(url, callback) {
        function doCallback() {
            if (typeof callback === 'function') {
                callback();
            }
        }

        var elem = document.createElement('script');
        elem.type = 'text/javascript';
        elem.charset = 'utf-8';
        if (elem.addEventListener) {
            elem.addEventListener('load', doCallback, false);
        } else { // IE
            elem.attachEvent('onreadystatechange', doCallback);
        }
        elem.src = url;
        document.getElementsByTagName('head')[0].appendChild(elem);
    }

    function doParse() {
        parse();
        if (isReady) {
            showCompiled();
        } else {
            showCode();
        }
        isReady = true;
    }

    function updateParser() {
        setTimeout(function() {
            if (!less.render) { // below 2.0.0
                parser = new less.Parser({
                    useFileCache: true
                });
                doParse();
            } else {
                // init plugins
                loadScript('js/plugin.js', doParse);
            }
        }, 10);
    }

    function updateVersion(version) {
        version = version || lessVersion.value;
        if (isReady) {
            hideCompiled();
        } else {
            hideCode();
        }
        delete window.less;
        if (_LESS_VERSIONS[version]) {
            less = _LESS_VERSIONS[version];
            updateParser();
        } else {
            loadScript('https://rawgit.com/less/less.js/v' + version + '/dist/less.min.js', function () {
                _LESS_VERSIONS[version] = less;
                updateParser();
            });
        }
    }

    /* Settings */

    // getting settings via query string
    var settings = parseQuery(window.location.hash);

    settings.version = settings.version || document.querySelector('#less-version option').value;
    settings.est = settings.est !== 'false';
    settings.autorun = settings.autorun !== 'false';

    var lessVersion = $('less-version');
    lessVersion.value = settings.version; // init

    var useEstBox = $('use-est');
    useEstBox.checked = settings.est;

    var autoRunBox = $('auto-run');
    autoRunBox.checked = settings.autorun;

    function toggleClass(id, className, value) {
        var elem = $(id);
        if (elem) {
            elem.classList[value ? 'add' : 'remove'](className);
        }
    }

    function updateUseEst(value) {
        value = value == null ? useEstBox.checked : !!value;
        toggleClass('source', 'est', value);
        parse();
    }

    function updateAutoRun(value) {
        value = value == null ? autoRunBox.checked : !!value;
        toggleClass('run', 'auto', value);
        $('run').disabled = value;
    }

    lessVersion.onchange = function () {
        saveSetting('version', this.value);
        settings.version = this.value;
        updateVersion(this.value);
    };

    useEstBox.onchange = function () {
        saveSetting('est', this.checked);
        settings.est = this.checked;
        updateUseEst(this.checked);
    };

    autoRunBox.onchange = function () {
        saveSetting('autorun', this.checked);
        settings.autorun = this.checked;
        updateAutoRun(this.checked);
        parse();
    };

    var runButton = $('run');
    runButton.onclick = function () {
        parse(true);
    };

    var link = $('link');
    link.onfocus = function () {
        var code = est.getValue();
        var hash = saveSetting('code', btoa(code), false);
        var url = window.location.href.split('#')[0] + '#' + hash;
        link.value = url;
        link.select();
        return false;
    };

    var imports = '@import "../src/all.less";\n';

    function getImports() {
        return settings.est ? imports : '';
    }

    function getLineNum(line) {
        return settings.est ? line - 1 : line;
    }

    function parse(isForce) {
        if (!settings.autorun && !isForce) {
            return;
        }

        var src = getImports() + est.getValue();
        if (less.render) { // 2.0.0 and above
            var options = {};

            if (useEstBox.checked) {
                options.plugins = [lessPluginUniqueDirectives];
            }
            less.render(src, options)
                .then(function (output) {
                    css.setValue(output.css);
                    $('compiled').classList.remove('error');
                }, function (error) {
                    showError(error);
                });
        } else {
            parser.parse(src, function (e, tree) {
                if (!e) {
                    try {
                        css.setValue(tree.toCSS());
                        $('compiled').classList.remove('error');
                    }
                    catch (e) {
                        showError(e);
                    }
                } else {
                    showError(e);
                }
            });
        }
    };

    function showError(e) {
        css.setValue(
            e.type + ' error: ' + e.message + '\n'
            + 'Line ' + getLineNum(e.line) + ': ' + e.extract[1]
        );
        $('compiled').classList.add('error');
    }

    var defaultCode = '@support-old-ie: false;\n\n.box {\n\
    .clearfix();\n\
    .box-shadow(0 -1px 0 #000, inset 0 1px 1px rgb(255, 0, 0));\n\
    .rotate(30deg);\n\
\n\
    .item {\n\
        .transition(transform 1s, color 1s);\n\
    }\n\
}';

    var code;
    if (settings.code) {
        code = atob(settings.code);
    } else if (localStorage) {
        code = localStorage.getItem('lessCode');
    }

    est.setValue(code || defaultCode);

    var t;
    est.on('change', function() {
        t && clearTimeout(t);

        if (!settings.code && localStorage) {
            localStorage.setItem('lessCode', est.getValue());
        }

        t = setTimeout(parse, 200);
    });

    var toggle = $('toggle');
    var isDiscussing = false;
    toggle.onclick = function () {
        isDiscussing = !isDiscussing;
        isDiscussing ? showComments() : hideComments();
    };

    /**
     * Load for the first time
     */

    var isReady = false;

    updateVersion();
    updateAutoRun();
    toggleClass('source', 'est', useEstBox.checked);
})();
