"use strict";

function SSync(config) {
    config = config || {};
    this.data = config.data || {};
    this.methods = config.methods || {};
    this._listen = {};
    this._values = {};
}

var p = SSync.prototype;

//p.makeGetter = function (exp) {
//    return (new Function('return this.' + exp)).bind(this);
//};
//
//p.makeSetter = function (exp) {
//    return (new Function('val', 'this.' + exp + '=val')).bind(this);
//};

p.makeBinding = function (exp, fn) {
    var self = this;
    if (!self._listen.hasOwnProperty(exp)) {
        self._listen[exp] = [];
    }
    self._listen[exp].push(fn);
    Object.defineProperty(this.data, exp, {
        configurable: true,
        enumerable: true,
        get: function () {
            return self._values[exp];
        },
        set: function (val) {
            self._values[exp] = val;
            var listeners = self._listen[exp];
            for (var i = 0, maxi = listeners.length; i < maxi; i++) {
                listeners[i](val);
            }
        }
    });
};

p.setValue = function (exp, val) {
    this._values[exp] = val;
};

p.compile = function (selector) {
    var self = this;

    var root = document.querySelector(selector);
    if (root) {
        inspect(root);
    }

    function inspect(el) {
        var i, maxi, attr, attrs = el.attributes, children = el.children;

        if (attrs) for (i = 0, maxi = attrs.length; i < maxi; i++) {
            attr = attrs[i];
            if (attr.name[0] === 's' && attr.name[1] === '-') {
                switch (attr.name) {
                    case 's-text':
                        self.makeBinding(attr.value, function (el, val) {
                            el.innerText = val;
                        }.bind(self, el));
                        break;
                    case 's-html':
                        self.makeBinding(attr.value, function (el, val) {
                            el.innerHTML = val;
                        }.bind(self, el));
                        break;
                    case 's-show':
                        self.makeBinding(attr.value, function (el, val) {
                            el.classList[val ? 'remove' : 'add']('s-hide');
                        }.bind(self, el));
                        break;
                    case 's-hide':
                        self.makeBinding(attr.value, function (el, val) {
                            el.classList[!val ? 'remove' : 'add']('s-hide');
                        }.bind(self, el));
                        break;
                    case 's-model':
                        el.addEventListener('input', function (exp, el) {
                            this.setValue(exp, el.value);
                        }.bind(self, attr.value, el));
                        self.makeBinding(attr.value, function (el, val) {
                            el.value = val;
                        }.bind(self, el));
                        break;
                    case 's-options':
                        var conf = attr.value.split(':');
                        if (conf.length === 3) {
                            var track = conf[1];
                            var text = conf[2];
                            self.makeBinding(conf[0], function (el, val) {
                                el.innerHTML = '';
                                var option = document.createElement('option');
                                option.innerText = '-';
                                option.value = '';
                                el.appendChild(option);
                                for (var j = 0, maxj = val.length; j < maxj; j++) {
                                    option = document.createElement('option');
                                    var o = val[j];
                                    option.innerText = o[text];
                                    option.value = o[track];
                                    el.appendChild(option);
                                }
                            }.bind(self, el));
                        } else {
                            self.makeBinding(attr.value, function (el, val) {
                                el.innerHTML = '';
                                var option = document.createElement('option');
                                option.innerText = '-';
                                option.value = '';
                                el.appendChild(option);
                                for (var j = 0, maxj = val.length; j < maxj; j++) {
                                    option = document.createElement('option');
                                    var o = val[j];
                                    option.innerText = o;
                                    option.value = o;
                                    el.appendChild(option);
                                }
                            }.bind(self, el));
                        }
                        break;
                    default:
                        if (attr.name.indexOf('s-on.') === 0) {
                            var cb = self.methods[attr.value];
                            if (typeof cb === 'function') {
                                el.addEventListener(attr.name.slice(5), cb.bind(self));
                            }
                        } else if (attr.name.indexOf('s-attr.') === 0) {
                            var attrName = attr.name.slice(7);
                            self.makeBinding(attr.value, function (el, oldAttr, attr, val) {
                                el.setAttribute(attr, val ? oldAttr + ' ' + val : oldAttr);
                            }.bind(self, el, el.getAttribute(attrName), attrName));
                        }
                        break;
                }
            }
        }

        if (children) for (i = 0, maxi = children.length; i < maxi; i++) {
            inspect(children[i]);
        }
    }

};