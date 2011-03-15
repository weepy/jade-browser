// Brequire - CommonJS support for the browser
function require(p) {
  var path = require.resolve(p)
  var module = require.modules[path];
  if(!module) throw("couldn't find module for: " + p);
  if(!module.exports) {
    module.exports = {};
    module.call(module.exports, module, module.exports, require.bind(path));
  }
  return module.exports;
}

require.modules = {};

require.resolve = function(path) {
  if(require.modules[path]) return path
  
  if(!path.match(/\.js$/)) {
    if(require.modules[path+".js"]) return path + ".js"
    if(require.modules[path+"/index.js"]) return path + "/index.js"
    if(require.modules[path+"/index"]) return path + "/index"    
  }
}

require.bind = function(path) {
  return function(p) {
    if(!p.match(/^\./)) return require(p)
  
    var fullPath = path.split('/');
    fullPath.pop();
    var parts = p.split('/');
    for (var i=0; i < parts.length; i++) {
      var part = parts[i];
      if (part == '..') fullPath.pop();
      else if (part != '.') fullPath.push(part);
    }
     return require(fullPath.join('/'));
  };
};

require.module = function(path, fn) {
  require.modules[path] = fn;
};require.module('jade/lib/compiler.js', function(module, exports, require) {
// start module: jade/lib/compiler.js


/*!
 * Jade - Compiler
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var nodes = require('./nodes')
  , filters = require('./filters')
  , doctypes = require('./doctypes')
  , selfClosing = require('./self-closing')
  , utils = require('./utils');

/**
 * Initialize `Compiler` with the given `node`.
 *
 * @param {Node} node
 * @param {Object} options
 * @api public
 */

var Compiler = module.exports = function Compiler(node, options) {
  this.options = options = options || {};
  this.node = node;
};

/**
 * Compiler prototype.
 */

Compiler.prototype = {
  
  /**
   * Compile parse tree to JavaScript.
   *
   * @api public
   */
  
  compile: function(){
    this.buf = ['var interp;'];
    this.visit(this.node);
    return this.buf.join('\n');
  },
  
  /**
   * Buffer the given `str` optionally escaped.
   *
   * @param {String} str
   * @param {Boolean} esc
   * @api public
   */
  
  buffer: function(str, esc){
    if (esc) str = utils.escape(str);
    this.buf.push("buf.push('" + str + "');");
  },
  
  /**
   * Buffer the given `node`'s lineno.
   *
   * @param {Node} node
   * @api public
   */
  
  line: function(node){
    if (node.instrumentLineNumber === false) return;
    this.buf.push('__.lineno = ' + node.line + ';');
  },
  
  /**
   * Visit `node`.
   *
   * @param {Node} node
   * @api public
   */
  
  visit: function(node){
    this.line(node);
    return this.visitNode(node);
  },
  
  /**
   * Visit `node`.
   *
   * @param {Node} node
   * @api public
   */
  
  visitNode: function(node){
    return this['visit' + node.constructor.name](node);
  },
  
  /**
   * Visit all nodes in `block`.
   *
   * @param {Block} block
   * @api public
   */

  visitBlock: function(block){
    for (var i = 0, len = block.length; i < len; ++i) {
      this.visit(block[i]);
    }
  },
  
  /**
   * Visit `doctype`. Sets terse mode to `true` when html 5
   * is used, causing self-closing tags to end with ">" vs "/>",
   * and boolean attributes are not mirrored.
   *
   * @param {Doctype} doctype
   * @api public
   */
  
  visitDoctype: function(doctype){
    var name = doctype.val;
    if ('5' == name) this.terse = true;
    doctype = doctypes[name || 'default'];
    this.xml = 0 == doctype.indexOf('<?xml');
    if (!doctype) throw new Error('unknown doctype "' + name + '"');
    this.buffer(doctype);
  },
  
  /**
   * Visit `tag` buffering tag markup, generating
   * attributes, visiting the `tag`'s code and block.
   *
   * @param {Tag} tag
   * @api public
   */
  
  visitTag: function(tag){
    var name = tag.name;

    if (~selfClosing.indexOf(name) && !this.xml) {
      this.buffer('<' + name);
      this.visitAttributes(tag.attrs);
      this.terse
        ? this.buffer('>')
        : this.buffer('/>');
    } else {
      // Optimize attributes buffering
      if (tag.attrs.length) {
        this.buffer('<' + name);
        if (tag.attrs.length) this.visitAttributes(tag.attrs);
        this.buffer('>');
      } else {
        this.buffer('<' + name + '>');
      }
      if (tag.code) this.visitCode(tag.code);
      if (tag.text) this.buffer(utils.text(tag.text[0].trimLeft()));
      this.escape = 'pre' == tag.name;
      this.visit(tag.block);
      this.buffer('</' + name + '>');
    }
  },
  
  /**
   * Visit `filter`, throwing when the filter does not exist.
   *
   * @param {Filter} filter
   * @api public
   */
  
  visitFilter: function(filter){
    var fn = filters[filter.name];
    if (!fn) throw new Error('unknown filter ":' + filter.name + '"');
    if (filter.block instanceof nodes.Block) {
      this.buf.push(fn(filter.block, this, filter.attrs));
    } else {
      this.buffer(fn(utils.text(filter.block.join('\\n')), filter.attrs));
    }
  },
  
  /**
   * Visit `text` node.
   *
   * @param {Text} text
   * @api public
   */
  
  visitText: function(text){
    text = utils.text(text.join('\\n'));
    if (this.escape) text = escape(text);
    this.buffer(text);
    this.buffer('\\n');
  },
  
  /**
   * Visit a `comment`, only buffering when the buffer flag is set.
   *
   * @param {Comment} comment
   * @api public
   */
  
  visitComment: function(comment){
    if (!comment.buffer) return;
    this.buffer('<!--' + utils.escape(comment.val) + '-->');
  },
  
  /**
   * Visit a `BlockComment`.
   *
   * @param {Comment} comment
   * @api public
   */
  
  visitBlockComment: function(comment){
    if (0 == comment.val.indexOf('if')) {
      this.buffer('<!--[' + comment.val + ']>');
      this.visit(comment.block);
      this.buffer('<![endif]-->');
    } else {
      this.buffer('<!--' + comment.val);
      this.visit(comment.block);
      this.buffer('-->');
    }
  },
  
  /**
   * Visit `code`, respecting buffer / escape flags.
   * If the code is followed by a block, wrap it in
   * a self-calling function.
   *
   * @param {Code} code
   * @api public
   */
  
  visitCode: function(code){
    // Wrap code blocks with {}.
    // we only wrap unbuffered code blocks ATM
    // since they are usually flow control

    // Buffer code
    if (code.buffer) {
      var val = code.val.trimLeft();
      this.buf.push('var __val__ = ' + val);
      val = 'null == __val__ ? "" : __val__';
      if (code.escape) val = 'escape(' + val + ')';
      this.buf.push("buf.push(" + val + ");");
    } else {
      this.buf.push(code.val);
    }

    // Block support
    if (code.block) {
      if (!code.buffer) this.buf.push('{');
      this.visit(code.block);
      if (!code.buffer) this.buf.push('}');
    }
  },
  
  /**
   * Visit `each` block.
   *
   * @param {Each} each
   * @api public
   */
  
  visitEach: function(each){
    this.buf.push(''
      + '// iterate ' + each.obj + '\n'
      + '(function(){\n'
      + '  if (\'number\' == typeof ' + each.obj + '.length) {\n'
      + '    for (var ' + each.key + ' = 0, $$l = ' + each.obj + '.length; ' + each.key + ' < $$l; ' + each.key + '++) {\n'
      + '      var ' + each.val + ' = ' + each.obj + '[' + each.key + '];\n');

    this.visit(each.block);

    this.buf.push(''
      + '    }\n'
      + '  } else {\n'
      + '    for (var ' + each.key + ' in ' + each.obj + ') {\n'
      + '      var ' + each.val + ' = ' + each.obj + '[' + each.key + '];\n');

    this.visit(each.block);

    this.buf.push('   }\n  }\n}).call(this);\n');
  },
  
  /**
   * Visit `attrs`.
   *
   * @param {Array} attrs
   * @api public
   */
  
  visitAttributes: function(attrs){
    var buf = []
      , classes = [];
    if (this.terse) buf.push('terse: true');
    attrs.forEach(function(attr){
      if (attr.name == 'class') {
        classes.push('(' + attr.val + ')');
      } else {
        var pair = "'" + attr.name + "':(" + attr.val + ')';
        buf.push(pair);
      }
    });
    if (classes.length) {
      classes = classes.join(" + ' ' + ");
      buf.push("class: " + classes);
    }
    this.buf.push("buf.push(attrs({ " + buf.join(', ') + " }));");
  }
};

/**
 * Escape the given string of `html`.
 *
 * @param {String} html
 * @return {String}
 * @api private
 */

function escape(html){
  return String(html)
    .replace(/&(?!\w+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


// end module: jade/lib/compiler.js
});
;

require.module('jade/lib/doctypes.js', function(module, exports, require) {
// start module: jade/lib/doctypes.js


/*!
 * Jade - doctypes
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

module.exports = {
    '5': '<!DOCTYPE html>'
  , 'xml': '<?xml version="1.0" encoding="utf-8" ?>'
  , 'default': '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">'
  , 'transitional': '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">'
  , 'strict': '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">'
  , 'frameset': '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Frameset//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-frameset.dtd">'
  , '1.1': '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">'
  , 'basic': '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML Basic 1.1//EN" "http://www.w3.org/TR/xhtml-basic/xhtml-basic11.dtd">'
  , 'mobile': '<!DOCTYPE html PUBLIC "-//WAPFORUM//DTD XHTML Mobile 1.2//EN" "http://www.openmobilealliance.org/tech/DTD/xhtml-mobile12.dtd">'
};

// end module: jade/lib/doctypes.js
});
;

require.module('jade/lib/filters.js', function(module, exports, require) {
// start module: jade/lib/filters.js


/*!
 * Jade - filters
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

module.exports = {
  
  /**
   * Wrap text with CDATA block.
   */
  
  cdata: function(str){
    return '<![CDATA[\\n' + str + '\\n]]>';
  },
  
  /**
   * Transform sass to css, wrapped in style tags.
   */
  
  sass: function(str){
    str = str.replace(/\\n/g, '\n');
    var sass = require('sass').render(str).replace(/\n/g, '\\n');
    return '<style>' + sass + '</style>'; 
  },
  
  /**
   * Transform stylus to css, wrapped in style tags.
   */
  
  stylus: function(str){
    var ret;
    str = str.replace(/\\n/g, '\n');
    var stylus = require('stylus');
    stylus(str).render(function(err, css){
      if (err) throw err;
      ret = css.replace(/\n/g, '\\n');
    });
    return '<style>' + ret + '</style>'; 
  },
  
  /**
   * Transform sass to css, wrapped in style tags.
   */
  
  less: function(str){
    var ret;
    str = str.replace(/\\n/g, '\n');
    require('less').render(str, function(err, css){
      if (err) throw err;
      ret = '<style>' + css.replace(/\n/g, '\\n') + '</style>';  
    });
    return ret;
  },
  
  /**
   * Transform markdown to html.
   */
  
  markdown: function(str){
    var md;

    // support markdown / discount
    try {
      md = require('markdown');
    } catch (err){
      try {
        md = require('discount');
      } catch (err) {
        try {
          md = require('markdown-js');
        } catch (err) {
          throw new Error('Cannot find markdown library, install markdown or discount');
        }
      }
    }

    str = str.replace(/\\n/g, '\n');
    return md.parse(str).replace(/\n/g, '\\n').replace(/'/g,'&#39;');
  },
  
  /**
   * Transform coffeescript to javascript.
   */

  coffeescript: function(str){
    str = str.replace(/\\n/g, '\n');
    var js = require('coffee-script').compile(str).replace(/\n/g, '\\n');
    return '<script type="text/javascript">\\n' + js + '</script>';
  }
};

// end module: jade/lib/filters.js
});
;

require.module('jade/lib/index.js', function(module, exports, require) {
// start module: jade/lib/index.js


/*!
 * Jade
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Parser = require('./parser')
  , Compiler = require('./compiler')
  , fs = require('fs');

/**
 * Library version.
 */

exports.version = '0.8.8';

/**
 * Intermediate JavaScript cache.
 * 
 * @type Object
 */

var cache = exports.cache = {};

/**
 * Expose self closing tags.
 * 
 * @type Object
 */

exports.selfClosing = require('./self-closing');

/**
 * Default supported doctypes.
 * 
 * @type Object
 */

exports.doctypes = require('./doctypes');

/**
 * Text filters.
 * 
 * @type Object
 */

exports.filters = require('./filters');

/**
 * Utilities.
 * 
 * @type Object
 */

exports.utils = require('./utils');

/**
 * Compiler.
 * 
 * @type Function
 */

exports.Compiler = Compiler;

/**
 * Nodes.
 * 
 * @type Object
 */

exports.nodes = require('./nodes');

/**
 * Render the given attributes object.
 *
 * @param {Object} obj
 * @return {String}
 * @api private
 */

function attrs(obj){
  var buf = []
    , terse = obj.terse;
  delete obj.terse;
  var keys = Object.keys(obj)
    , len = keys.length;
  if (len) {
    buf.push('');
    for (var i = 0; i < len; ++i) {
      var key = keys[i]
        , val = obj[key];
      if (typeof val === 'boolean' || val === '' || val == null) {
        if (val) {
          terse
            ? buf.push(key)
            : buf.push(key + '="' + key + '"');
        }
      } else {
        buf.push(key + '="' + escape(val) + '"');
      }
    }
  }
  return buf.join(' ');
}

/**
 * Escape the given string of `html`.
 *
 * @param {String} html
 * @return {String}
 * @api private
 */

function escape(html){
  return String(html)
    .replace(/&(?!\w+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Re-throw the given `err` in context to the
 * `str` of jade, `filename`, and `lineno`.
 *
 * @param {Error} err
 * @param {String} str
 * @param {String} filename
 * @param {String} lineno
 * @api private
 */

function rethrow(err, str, filename, lineno){
  var start = lineno - 3 > 0
    ? lineno - 3
    : 0;

  // Error context
  var context = str.split('\n').slice(start, lineno).map(function(line, i){
    return '    '
      + (i + start + 1)
      + ". '"
      + line.replace("'", "\\'")
      + "'";
  }).join('\n');

  // Alter exception message
  err.path = filename;
  err.message = (filename || 'Jade') + ':' + lineno 
    + '\n' + context + '\n\n' + err.message;
  throw err;
}

/**
 * Parse the given `str` of jade and return a function body.
 *
 * @param {String} str
 * @param {Object} options
 * @return {String}
 * @api private
 */

function parse(str, options){
  var filename = options.filename;
  try {
    // Parse
    var parser = new Parser(str, filename);
    if (options.debug) parser.debug();

    // Compile
    var compiler = new (options.compiler || Compiler)(parser.parse(), options)
      , js = compiler.compile();

    // Debug compiler
    if (options.debug) {
      console.log('\n\x1b[1mCompiled Function\x1b[0m:\n\n%s', js.replace(/^/gm, '  '));
    }

    try {
      return ''
        + attrs.toString() + '\n\n'
        + escape.toString()  + '\n\n'
        + 'var buf = [];\n'
        + 'with (locals || {}) {' + js + '}'
        + 'return buf.join("");';
    } catch (err) {
      process.compile(js, filename || 'Jade');
      return;
    }
  } catch (err) {
    rethrow(err, str, filename, parser.lexer.lineno);
  }
}

/**
 * Compile a `Function` representation of the given jade `str`.
 *
 * @param {String} str
 * @param {Options} options
 * @return {Function}
 * @api public
 */

exports.compile = function(str, options){
  var options = options || {}
    , input = JSON.stringify(str)
    , filename = options.filename
      ? JSON.stringify(options.filename)
      : 'undefined';

  // Reduce closure madness by injecting some locals
  var fn = [
      'var __ = { lineno: 1, input: ' + input + ', filename: ' + filename + ' };'
    , rethrow.toString()
    , 'try {'
    , parse(String(str), options || {})
    , '} catch (err) {'
    , '  rethrow(err, __.input, __.filename, __.lineno);'
    , '}'
  ].join('\n');

  return new Function('locals', fn);
};

/**
 * Render the given `str` of jade.
 *
 * Options:
 *
 *   - `scope`     Evaluation scope (`this`)
 *   - `locals`    Local variable object
 *   - `filename`  Used in exceptions, and required by `cache`
 *   - `cache`     Cache intermediate JavaScript in memory keyed by `filename`
 *   - `compiler`  Compiler to replade jade's default
 *
 * @param {String|Buffer} str
 * @param {Object} options
 * @return {String}
 * @api public
 */

exports.render = function(str, options){
  var fn
    , options = options || {}
    , filename = options.filename;

  // Accept Buffers
  str = String(str);

  // Cache support
  if (options.cache) {
    if (filename) {
      if (cache[filename]) {
        fn = cache[filename];
      } else {
        fn = cache[filename] = new Function('locals', parse(str, options));
      }
    } else {
      throw new Error('filename is required when using the cache option');
    }
  } else {
    fn = new Function('locals', parse(str, options));
  }

  // Render the template
  try {
    var locals = options.locals || {}
      , meta = { lineno: 1 };
    locals.__ = meta;
    return fn.call(options.scope, locals); 
  } catch (err) {
    rethrow(err, str, filename, meta.lineno);
  }
};

/**
 * Render jade template at the given `path`.
 *
 * @param {String} path
 * @param {Object} options
 * @param {Function} fn
 * @api public
 */

exports.renderFile = function(path, options, fn){
  if (typeof options === 'function') {
    fn = options;
    options = {};
  }
  options.filename = path;

  // Primed cache
  if (options.cache && cache[path]) {
    try {
      fn(null, exports.render('', options));
    } catch (err) {
      fn(err);
    }
  } else {
    fs.readFile(path, 'utf8', function(err, str){
      if (err) return fn(err);
      try {
        fn(null, exports.render(str, options));
      } catch (err) {
        fn(err);
      }
    });
  }
};

// end module: jade/lib/index.js
});
;

require.module('jade/lib/jade.js', function(module, exports, require) {
// start module: jade/lib/jade.js


/*!
 * Jade
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Parser = require('./parser')
  , Compiler = require('./compiler')
  , fs = require('fs');

/**
 * Library version.
 */

exports.version = '0.8.8';

/**
 * Intermediate JavaScript cache.
 * 
 * @type Object
 */

var cache = exports.cache = {};

/**
 * Expose self closing tags.
 * 
 * @type Object
 */

exports.selfClosing = require('./self-closing');

/**
 * Default supported doctypes.
 * 
 * @type Object
 */

exports.doctypes = require('./doctypes');

/**
 * Text filters.
 * 
 * @type Object
 */

exports.filters = require('./filters');

/**
 * Utilities.
 * 
 * @type Object
 */

exports.utils = require('./utils');

/**
 * Compiler.
 * 
 * @type Function
 */

exports.Compiler = Compiler;

/**
 * Nodes.
 * 
 * @type Object
 */

exports.nodes = require('./nodes');

/**
 * Render the given attributes object.
 *
 * @param {Object} obj
 * @return {String}
 * @api private
 */

function attrs(obj){
  var buf = []
    , terse = obj.terse;
  delete obj.terse;
  var keys = Object.keys(obj)
    , len = keys.length;
  if (len) {
    buf.push('');
    for (var i = 0; i < len; ++i) {
      var key = keys[i]
        , val = obj[key];
      if (typeof val === 'boolean' || val === '' || val == null) {
        if (val) {
          terse
            ? buf.push(key)
            : buf.push(key + '="' + key + '"');
        }
      } else {
        buf.push(key + '="' + escape(val) + '"');
      }
    }
  }
  return buf.join(' ');
}

/**
 * Escape the given string of `html`.
 *
 * @param {String} html
 * @return {String}
 * @api private
 */

function escape(html){
  return String(html)
    .replace(/&(?!\w+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Re-throw the given `err` in context to the
 * `str` of jade, `filename`, and `lineno`.
 *
 * @param {Error} err
 * @param {String} str
 * @param {String} filename
 * @param {String} lineno
 * @api private
 */

function rethrow(err, str, filename, lineno){
  var start = lineno - 3 > 0
    ? lineno - 3
    : 0;

  // Error context
  var context = str.split('\n').slice(start, lineno).map(function(line, i){
    return '    '
      + (i + start + 1)
      + ". '"
      + line.replace("'", "\\'")
      + "'";
  }).join('\n');

  // Alter exception message
  err.path = filename;
  err.message = (filename || 'Jade') + ':' + lineno 
    + '\n' + context + '\n\n' + err.message;
  throw err;
}

/**
 * Parse the given `str` of jade and return a function body.
 *
 * @param {String} str
 * @param {Object} options
 * @return {String}
 * @api private
 */

function parse(str, options){
  var filename = options.filename;
  try {
    // Parse
    var parser = new Parser(str, filename);
    if (options.debug) parser.debug();

    // Compile
    var compiler = new (options.compiler || Compiler)(parser.parse(), options)
      , js = compiler.compile();

    // Debug compiler
    if (options.debug) {
      console.log('\n\x1b[1mCompiled Function\x1b[0m:\n\n%s', js.replace(/^/gm, '  '));
    }

    try {
      return ''
        + attrs.toString() + '\n\n'
        + escape.toString()  + '\n\n'
        + 'var buf = [];\n'
        + 'with (locals || {}) {' + js + '}'
        + 'return buf.join("");';
    } catch (err) {
      process.compile(js, filename || 'Jade');
      return;
    }
  } catch (err) {
    rethrow(err, str, filename, parser.lexer.lineno);
  }
}

/**
 * Compile a `Function` representation of the given jade `str`.
 *
 * @param {String} str
 * @param {Options} options
 * @return {Function}
 * @api public
 */

exports.compile = function(str, options){
  var options = options || {}
    , input = JSON.stringify(str)
    , filename = options.filename
      ? JSON.stringify(options.filename)
      : 'undefined';

  // Reduce closure madness by injecting some locals
  var fn = [
      'var __ = { lineno: 1, input: ' + input + ', filename: ' + filename + ' };'
    , rethrow.toString()
    , 'try {'
    , parse(String(str), options || {})
    , '} catch (err) {'
    , '  rethrow(err, __.input, __.filename, __.lineno);'
    , '}'
  ].join('\n');

  return new Function('locals', fn);
};

/**
 * Render the given `str` of jade.
 *
 * Options:
 *
 *   - `scope`     Evaluation scope (`this`)
 *   - `locals`    Local variable object
 *   - `filename`  Used in exceptions, and required by `cache`
 *   - `cache`     Cache intermediate JavaScript in memory keyed by `filename`
 *   - `compiler`  Compiler to replade jade's default
 *
 * @param {String|Buffer} str
 * @param {Object} options
 * @return {String}
 * @api public
 */

exports.render = function(str, options){
  var fn
    , options = options || {}
    , filename = options.filename;

  // Accept Buffers
  str = String(str);

  // Cache support
  if (options.cache) {
    if (filename) {
      if (cache[filename]) {
        fn = cache[filename];
      } else {
        fn = cache[filename] = new Function('locals', parse(str, options));
      }
    } else {
      throw new Error('filename is required when using the cache option');
    }
  } else {
    fn = new Function('locals', parse(str, options));
  }

  // Render the template
  try {
    var locals = options.locals || {}
      , meta = { lineno: 1 };
    locals.__ = meta;
    return fn.call(options.scope, locals); 
  } catch (err) {
    rethrow(err, str, filename, meta.lineno);
  }
};

/**
 * Render jade template at the given `path`.
 *
 * @param {String} path
 * @param {Object} options
 * @param {Function} fn
 * @api public
 */

exports.renderFile = function(path, options, fn){
  if (typeof options === 'function') {
    fn = options;
    options = {};
  }
  options.filename = path;

  // Primed cache
  if (options.cache && cache[path]) {
    try {
      fn(null, exports.render('', options));
    } catch (err) {
      fn(err);
    }
  } else {
    fs.readFile(path, 'utf8', function(err, str){
      if (err) return fn(err);
      try {
        fn(null, exports.render(str, options));
      } catch (err) {
        fn(err);
      }
    });
  }
};

// end module: jade/lib/jade.js
});
;

require.module('jade/lib/lexer.js', function(module, exports, require) {
// start module: jade/lib/lexer.js


/*!
 * Jade - Lexer
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Initialize `Lexer` with the given `str`.
 *
 * @param {String} str
 * @api private
 */

var Lexer = module.exports = function Lexer(str) {
  this.input = str.replace(/\r\n|\r/g, '\n');
  this.deferredTokens = [];
  this.lastIndents = 0;
  this.lineno = 1;
  this.stash = [];
  this.indentStack = [];
  this.indentRe = null;
  this.textPipe = true;
};

/**
 * Lexer prototype.
 */

Lexer.prototype = {
  
  /**
   * Construct a token with the given `type` and `val`.
   *
   * @param {String} type
   * @param {String} val
   * @return {Object}
   * @api private
   */
  
  tok: function(type, val){
    return {
        type: type
      , line: this.lineno
      , val: val
    }
  },
  
  /**
   * Consume the given `len` of input.
   *
   * @param {Number} len
   * @api private
   */
  
  consume: function(len){
    this.input = this.input.substr(len);
  },
  
  /**
   * Scan for `type` with the given `regexp`.
   *
   * @param {String} type
   * @param {RegExp} regexp
   * @return {Object}
   * @api private
   */
  
  scan: function(regexp, type){
    var captures;
    if (captures = regexp.exec(this.input)) {
      this.consume(captures[0].length);
      return this.tok(type, captures[1]);
    }
  },
  
  /**
   * Defer the given `tok`.
   *
   * @param {Object} tok
   * @api private
   */
  
  defer: function(tok){
    this.deferredTokens.push(tok);
  },
  
  /**
   * Lookahead `n` tokens.
   *
   * @param {Number} n
   * @return {Object}
   * @api private
   */
  
  lookahead: function(n){
    var fetch = n - this.stash.length;
    while (fetch-- > 0) this.stash.push(this.next());
    return this.stash[--n];
  },
  
  /**
   * Return the indexOf `start` / `end` delimiters.
   *
   * @param {String} start
   * @param {String} end
   * @return {Number}
   * @api private
   */
  
  indexOfDelimiters: function(start, end){
    var str = this.input
      , nstart = 0
      , nend = 0
      , pos = 0;
    for (var i = 0, len = str.length; i < len; ++i) {
      if (start == str[i]) {
        ++nstart;
      } else if (end == str[i]) {
        if (++nend == nstart) {
          pos = i;
          break;
        }
      }
    }
    return pos;
  },
  
  /**
   * Stashed token.
   */
  
  stashed: function() {
    return this.stash.length
      && this.stash.shift();
  },
  
  /**
   * Deferred token.
   */
  
  deferred: function() {
    return this.deferredTokens.length 
      && this.deferredTokens.shift();
  },
  
  /**
   * end-of-source.
   */
  
  eos: function() {
    if (this.input.length) return;
    if (this.indentStack.length) {
      this.indentStack.shift();
      return this.tok('outdent');
    } else {
      return this.tok('eos');
    }
  },

  /**
   * Block comment
   */

   blockComment: function() {
     var captures;
     if (captures = /^\/([^\n]+)/.exec(this.input)) {
       this.consume(captures[0].length);
       var tok = this.tok('block-comment', captures[1]);
       return tok;
     }
   },
  
  /**
   * Comment.
   */
  
  comment: function() {
    var captures;
    if (captures = /^ *\/\/(-)?([^\n]+)/.exec(this.input)) {
      this.consume(captures[0].length);
      var tok = this.tok('comment', captures[2]);
      tok.buffer = '-' != captures[1];
      return tok;
    }
  },
  
  /**
   * Tag.
   */
  
  tag: function() {
    var captures;
    if (captures = /^(\w[-:\w]*)/.exec(this.input)) {
      this.consume(captures[0].length);
      var tok, name = captures[1];
      if (':' == name[name.length - 1]) {
        name = name.slice(0, -1);
        tok = this.tok('tag', name);
        this.deferredTokens.push(this.tok(':'));
        while (' ' == this.input[0]) this.input = this.input.substr(1);
      } else {
        tok = this.tok('tag', name);
      }
      return tok;
    }
  },
  
  /**
   * Filter.
   */
  
  filter: function() {
    return this.scan(/^:(\w+)/, 'filter');
  },
  
  /**
   * Doctype.
   */
  
  doctype: function() {
    return this.scan(/^!!! *(\w+)?/, 'doctype');
  },
  
  /**
   * Id.
   */
  
  id: function() {
    return this.scan(/^#([\w-]+)/, 'id');
  },
  
  /**
   * Class.
   */
  
  className: function() {
    return this.scan(/^\.([\w-]+)/, 'class');
  },
  
  /**
   * Text.
   */
  
  text: function() {
    return this.scan(/^(?:\| ?)?([^\n]+)/, 'text');
  },

  /**
   * Each.
   */
  
  each: function() {
    var captures;
    if (captures = /^- *each *(\w+)(?: *, *(\w+))? * in *([^\n]+)/.exec(this.input)) {
      this.consume(captures[0].length);
      var tok = this.tok('each', captures[1]);
      tok.key = captures[2] || 'index';
      tok.code = captures[3];
      return tok;
    }
  },
  
  /**
   * Code.
   */
  
  code: function() {
    var captures;
    if (captures = /^(!?=|-)([^\n]+)/.exec(this.input)) {
      this.consume(captures[0].length);
      var flags = captures[1];
      captures[1] = captures[2];
      var tok = this.tok('code', captures[1]);
      tok.escape = flags[0] === '=';
      tok.buffer = flags[0] === '=' || flags[1] === '=';
      return tok;
    }
  },
  
  /**
   * Attributes.
   */
  
  attrs: function() {
    if ('(' == this.input[0]) {
      var index = this.indexOfDelimiters('(', ')')
        , str = this.input.substr(1, index-1)
        , tok = this.tok('attrs')
        , len = str.length
        , states = ['key']
        , key = ''
        , val = ''
        , c;

      function state(){
        return states[states.length - 1];
      }

      this.consume(index + 1);
      tok.attrs = {};

      function parse(c) {
        switch (c) {
          case ',':
          case '\n':
            switch (state()) {
              case 'expr':
              case 'array':
              case 'string':
              case 'object':
                val += c;
                break;
              default:
                states.push('key');
                val = val.trim();
                key = key.trim();
                if ('' == key) return;
                tok.attrs[key.replace(/^['"]|['"]$/g, '')] = '' == val
                  ? true
                  : val;
                key = val = '';
            }
            break;
          case ':':
          case '=':
            switch (state()) {
              case 'val':
              case 'expr':
              case 'array':
              case 'string':
              case 'object':
                val += c;
                break;
              default:
                states.push('val');
            }
            break;
          case '(':
            states.push('expr');
            val += c;
            break;
          case ')':
            states.pop();
            val += c;
            break;
          case '{':
            states.push('object');
            val += c;
            break;
          case '}':
            states.pop();
            val += c;
            break;
          case '[':
            states.push('array');
            val += c;
            break;
          case ']':
            states.pop();
            val += c;
            break;
          case '"':
          case "'":
            if ('key' == state()) break;
            'string' == state()
              ? states.pop()
              : states.push('string');
            val += c;
            break;
          case '':
            break;
          default:
            if ('key' == state()) {
              key += c;
            } else {
              val += c;
            }
        }
      }

      for (var i = 0; i < len; ++i) {
        parse(str[i]);
      }

      parse(',');

      return tok;
    }
  },
  
  /**
   * Indent.
   */
  
  indent: function() {
    var captures, re;

    // established regexp
    if (this.indentRe) {
      captures = this.indentRe.exec(this.input);
    // determine regexp
    } else {
      // tabs
      re = /^\n(\t*) */;
      captures = re.exec(this.input);

      // spaces
      if (captures && !captures[1].length) {
        re = /^\n( *)/;
        captures = re.exec(this.input);
      }

      // established
      if (captures && captures[1].length) this.indentRe = re;
    }

    if (captures) {
      var tok
        , indents = captures[1].length;

      ++this.lineno;
      this.consume(indents + 1);

      if (' ' == this.input[0] || '\t' == this.input[0]) {
        throw new Error('Invalid indentation, you can use tabs or spaces but not both');
      }

      // blank line
      if ('\n' == this.input[0]) return this.advance();

      // outdent
      if (this.indentStack.length && indents < this.indentStack[0]) {
        while (this.indentStack.length && this.indentStack[0] > indents) {
          this.stash.push(this.tok('outdent'));
          this.indentStack.shift();
        }
        tok = this.stash.pop();
      // indent
      } else if (indents && indents != this.indentStack[0]) {
        this.indentStack.unshift(indents);
        tok = this.tok('indent');
      // newline
      } else {
        tok = this.tok('newline');
      }

      return tok;
    }
  },

  /**
   * Pipe-less text consumed only when 
   * textPipe is false;
   */

  pipelessText: function() {
    if (false === this.textPipe) {
      if ('\n' == this.input[0]) return;
      var i = this.input.indexOf('\n')
        , str = this.input.substr(0, i);
      if (-1 == i) return;
      this.consume(str.length);
      return this.tok('text', str);
    }
  },

  /**
   * ':'
   */

  colon: function() {
    return this.scan(/^: */, ':');
  },

  /**
   * Return the next token object, or those
   * previously stashed by lookahead.
   *
   * @return {Object}
   * @api private
   */
  
  advance: function(){
    return this.stashed()
      || this.next();
  },
  
  /**
   * Return the next token object.
   *
   * @return {Object}
   * @api private
   */
  
  next: function() {
    return this.deferred()
      || this.eos()
      || this.pipelessText()
      || this.tag()
      || this.filter()
      || this.each()
      || this.code()
      || this.doctype()
      || this.id()
      || this.className()
      || this.attrs()
      || this.indent()
      || this.comment()
      || this.blockComment()
      || this.colon()
      || this.text();
  }
};


// end module: jade/lib/lexer.js
});
;

require.module('jade/lib/nodes/block-comment.js', function(module, exports, require) {
// start module: jade/lib/nodes/block-comment.js


/*!
 * Jade - nodes - BlockComment
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Node = require('./node');

/**
 * Initialize a `BlockComment` with the given `block`.
 *
 * @param {String} val
 * @param {Block} block
 * @api public
 */

var BlockComment = module.exports = function BlockComment(val, block) {
  this.block = block;
  this.val = val;
};

/**
 * Inherit from `Node`.
 */

BlockComment.prototype.__proto__ = Node.prototype;

// end module: jade/lib/nodes/block-comment.js
});
;

require.module('jade/lib/nodes/block.js', function(module, exports, require) {
// start module: jade/lib/nodes/block.js


/*!
 * Jade - nodes - Block
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Node = require('./node');

/**
 * Initialize a new `Block` with an optional `node`.
 *
 * @param {Node} node
 * @api public
 */

var Block = module.exports = function Block(node){
  if (node) this.push(node);
};

/**
 * Inherit from `Node`.
 */

Block.prototype.__proto__ = Node.prototype;


// end module: jade/lib/nodes/block.js
});
;

require.module('jade/lib/nodes/code.js', function(module, exports, require) {
// start module: jade/lib/nodes/code.js


/*!
 * Jade - nodes - Code
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Node = require('./node');

/**
 * Initialize a `Code` node with the given code `val`.
 * Code may also be optionally buffered and escaped.
 *
 * @param {String} val
 * @param {Boolean} buffer
 * @param {Boolean} escape
 * @api public
 */

var Code = module.exports = function Code(val, buffer, escape) {
  this.val = val;
  this.buffer = buffer;
  this.escape = escape;
  if (/^ *else/.test(val)) this.instrumentLineNumber = false;
};

/**
 * Inherit from `Node`.
 */

Code.prototype.__proto__ = Node.prototype;

// end module: jade/lib/nodes/code.js
});
;

require.module('jade/lib/nodes/comment.js', function(module, exports, require) {
// start module: jade/lib/nodes/comment.js


/*!
 * Jade - nodes - Comment
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Node = require('./node');

/**
 * Initialize a `Comment` with the given `val`, optionally `buffer`,
 * otherwise the comment may render in the output.
 *
 * @param {String} val
 * @param {Boolean} buffer
 * @api public
 */

var Comment = module.exports = function Comment(val, buffer) {
  this.val = val;
  this.buffer = buffer;
};

/**
 * Inherit from `Node`.
 */

Comment.prototype.__proto__ = Node.prototype;

// end module: jade/lib/nodes/comment.js
});
;

require.module('jade/lib/nodes/doctype.js', function(module, exports, require) {
// start module: jade/lib/nodes/doctype.js


/*!
 * Jade - nodes - Doctype
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Node = require('./node');

/**
 * Initialize a `Doctype` with the given `val`. 
 *
 * @param {String} val
 * @api public
 */

var Doctype = module.exports = function Doctype(val) {
  this.val = val;
};

/**
 * Inherit from `Node`.
 */

Doctype.prototype.__proto__ = Node.prototype;

// end module: jade/lib/nodes/doctype.js
});
;

require.module('jade/lib/nodes/each.js', function(module, exports, require) {
// start module: jade/lib/nodes/each.js


/*!
 * Jade - nodes - Each
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Node = require('./node');

/**
 * Initialize an `Each` node, representing iteration
 *
 * @param {String} obj
 * @param {String} val
 * @param {String} key
 * @param {Block} block
 * @api public
 */

var Each = module.exports = function Each(obj, val, key, block) {
  this.obj = obj;
  this.val = val;
  this.key = key;
  this.block = block;
};

/**
 * Inherit from `Node`.
 */

Each.prototype.__proto__ = Node.prototype;

// end module: jade/lib/nodes/each.js
});
;

require.module('jade/lib/nodes/filter.js', function(module, exports, require) {
// start module: jade/lib/nodes/filter.js


/*!
 * Jade - nodes - Filter
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Node = require('./node');

/**
 * Initialize a `Filter` node with the given 
 * filter `name` and `block`.
 *
 * @param {String} name
 * @param {Block|Node} block
 * @api public
 */

var Filter = module.exports = function Filter(name, block, attrs) {
  this.name = name;
  this.block = block;
  this.attrs = attrs;
};

/**
 * Inherit from `Node`.
 */

Filter.prototype.__proto__ = Node.prototype;

// end module: jade/lib/nodes/filter.js
});
;

require.module('jade/lib/nodes/index.js', function(module, exports, require) {
// start module: jade/lib/nodes/index.js


/*!
 * Jade - nodes
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

exports.Node = require('./node');
exports.Tag = require('./tag');
exports.Code = require('./code');
exports.Each = require('./each');
exports.Text = require('./text');
exports.Block = require('./block');
exports.Filter = require('./filter');
exports.Comment = require('./comment');
exports.BlockComment = require('./block-comment');
exports.Doctype = require('./doctype');


// end module: jade/lib/nodes/index.js
});
;

require.module('jade/lib/nodes/node.js', function(module, exports, require) {
// start module: jade/lib/nodes/node.js


/*!
 * Jade - nodes - Node
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Initialize a `Node`.
 *
 * @api public
 */

var Node = module.exports = function Node(){};

/**
 * Inherit from `Array`.
 */

Node.prototype.__proto__ = Array.prototype;

// end module: jade/lib/nodes/node.js
});
;

require.module('jade/lib/nodes/tag.js', function(module, exports, require) {
// start module: jade/lib/nodes/tag.js


/*!
 * Jade - nodes - Tag
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Node = require('./node'),
    Block = require('./block');

/**
 * Initialize a `Tag` node with the given tag `name` and optional `block`.
 *
 * @param {String} name
 * @param {Block} block
 * @api public
 */

var Tag = module.exports = function Tag(name, block) {
  this.name = name;
  this.attrs = [];
  this.block = block || new Block;
};

/**
 * Set attribute `name` to `val`, keep in mind these become
 * part of a raw js object literal, so to quote a value you must
 * '"quote me"', otherwise or example 'user.name' is literal JavaScript.
 *
 * @param {String} name
 * @param {String} val
 * @return {Tag} for chaining
 * @api public
 */

Tag.prototype.setAttribute = function(name, val){
  this.attrs.push({ name: name, val: val });
  return this;
};

/**
 * Remove attribute `name` when present.
 *
 * @param {String} name
 * @api public
 */

Tag.prototype.removeAttribute = function(name){
  for (var i = 0, len = this.attrs.length; i < len; ++i) {
    if (this.attrs[i] && this.attrs[i].name == name) {
      delete this.attrs[i];
    }
  }
};

/**
 * Get attribute value by `name`.
 *
 * @param {String} name
 * @return {String}
 * @api public
 */

Tag.prototype.getAttribute = function(name){
  for (var i = 0, len = this.attrs.length; i < len; ++i) {
    if (this.attrs[i] && this.attrs[i].name == name) {
      return this.attrs[i].val;
    }
  }
};

/**
 * Inherit from `Node`.
 */

Tag.prototype.__proto__ = Node.prototype;


// end module: jade/lib/nodes/tag.js
});
;

require.module('jade/lib/nodes/text.js', function(module, exports, require) {
// start module: jade/lib/nodes/text.js


/*!
 * Jade - nodes - Text
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Node = require('./node');

/**
 * Initialize a `Text` node with optional `line`.
 *
 * @param {String} line
 * @api public
 */

var Text = module.exports = function Text(line) {
  if ('string' == typeof line) this.push(line);
};

/**
 * Inherit from `Node`.
 */

Text.prototype.__proto__ = Node.prototype;

// end module: jade/lib/nodes/text.js
});
;

require.module('jade/lib/parser.js', function(module, exports, require) {
// start module: jade/lib/parser.js


/*!
 * Jade - Parser
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Lexer = require('./lexer')
  , nodes = require('./nodes');

/**
 * Initialize `Parser` with the given input `str` and `filename`.
 *
 * @param {String} str
 * @param {String} filename
 * @api public
 */

var Parser = exports = module.exports = function Parser(str, filename){
  this.input = str;
  this.lexer = new Lexer(str);
  this.filename = filename;
};

/**
 * Tags that may not contain tags.
 */

var textOnly = exports.textOnly = ['pre', 'script', 'textarea', 'style'];

/**
 * Parser prototype.
 */

Parser.prototype = {
  
  /**
   * Output parse tree to stdout. 
   *
   * @api public
   */
  
  debug: function(){
    var lexer = new Lexer(this.input)
      , tree = require('sys').inspect(this.parse(), false, 12, true);
    console.log('\n\x1b[1mParse Tree\x1b[0m:\n');
    console.log(tree);
    this.lexer = lexer;
  },
  
  /**
   * Return the next token object.
   *
   * @return {Object}
   * @api private
   */

  advance: function(){
    return this.lexer.advance();
  },
  
  /**
   * Single token lookahead.
   *
   * @return {Object}
   * @api private
   */
  
  peek: function() {
    return this.lookahead(1);
  },
  
  /**
   * Return lexer lineno.
   *
   * @return {Number}
   * @api private
   */
  
  line: function() {
    return this.lexer.lineno;
  },
  
  /**
   * `n` token lookahead.
   *
   * @param {Number} n
   * @return {Object}
   * @api private
   */
  
  lookahead: function(n){
    return this.lexer.lookahead(n);
  },
  
  /**
   * Parse input returning a string of js for evaluation.
   *
   * @return {String}
   * @api public
   */
  
  parse: function(){
    var block = new nodes.Block;
    block.line = this.line();
    while (this.peek().type !== 'eos') {
      if (this.peek().type === 'newline') {
        this.advance();
      } else {
        block.push(this.parseExpr());
      }
    }
    return block;
  },
  
  /**
   * Expect the given type, or throw an exception.
   *
   * @param {String} type
   * @api private
   */
  
  expect: function(type){
    if (this.peek().type === type) {
      return this.advance();
    } else {
      throw new Error('expected "' + type + '", but got "' + this.peek().type + '"');
    }
  },
  
  /**
   * Accept the given `type`.
   *
   * @param {String} type
   * @api private
   */
  
  accept: function(type){
    if (this.peek().type === type) {
      return this.advance();
    }
  },
  
  /**
   *   tag
   * | doctype
   * | filter
   * | comment
   * | text
   * | each
   * | code
   * | id
   * | class
   */
  
  parseExpr: function(){
    switch (this.peek().type) {
      case 'tag':
        return this.parseTag();
      case 'doctype':
        return this.parseDoctype();
      case 'filter':
        return this.parseFilter();
      case 'comment':
        return this.parseComment();
      case 'block-comment':
        return this.parseBlockComment();
      case 'text':
        return this.parseText();
      case 'each':
        return this.parseEach();
      case 'code':
        return this.parseCode();
      case 'id':
      case 'class':
        var tok = this.advance();
        this.lexer.defer(this.lexer.tok('tag', 'div'));
        this.lexer.defer(tok);
        return this.parseExpr();
      default:
        throw new Error('unexpected token "' + this.peek().type + '"');
    }
  },
  
  /**
   * Text
   */
  
  parseText: function(){
    var tok = this.expect('text')
      , node = new nodes.Text(tok.val);
    node.line = this.line();
    return node;
  },
  
  /**
   * code
   */
  
  parseCode: function(){
    var tok = this.expect('code')
      , node = new nodes.Code(tok.val, tok.buffer, tok.escape);
    node.line = this.line();
    if ('indent' == this.peek().type) {
      node.block = this.parseBlock();
    }
    return node;
  },

  /**
   * block comment
   */
  
  parseBlockComment: function(){
    var tok = this.expect('block-comment')
      , node = new nodes.BlockComment(tok.val, this.parseBlock());
    node.line = this.line();
    return node;
  },

  
  /**
   * comment
   */
  
  parseComment: function(){
    var tok = this.expect('comment')
      , node = new nodes.Comment(tok.val, tok.buffer);
    node.line = this.line();
    return node;
  },
  
  /**
   * doctype
   */
  
  parseDoctype: function(){
    var tok = this.expect('doctype')
      , node = new nodes.Doctype(tok.val);
    node.line = this.line();
    return node;
  },
  
  /**
   * filter attrs? (text | block)
   */
  
  parseFilter: function(){
    var block
      , tok = this.expect('filter')
      , attrs = this.accept('attrs');

    if ('text' == tok.val) {
      this.lexer.textPipe = false;
      block = this.parseTextBlock();
      this.lexer.textPipe = true;
      return block;
    } else if ('text' == this.lookahead(2).type) {
      block = this.parseTextBlock();
    } else {
      block = this.parseBlock();
    }

    var node = new nodes.Filter(tok.val, block, attrs && attrs.attrs);
    node.line = this.line();
    return node;
  },
  
  /**
   * each block
   */
  
  parseEach: function(){
    var tok = this.expect('each')
      , node = new nodes.Each(tok.code, tok.val, tok.key, this.parseBlock());
    node.line = this.line();
    return node;
  },
  
  /**
   * indent (text | newline)* outdent
   */
   
  parseTextBlock: function(){
    var text = new nodes.Text
      , pipeless = false === this.lexer.textPipe;
    text.line = this.line();
    this.expect('indent');
    while ('outdent' != this.peek().type) {
      switch (this.peek().type) {
        case 'newline':
          if (pipeless) text.push('\\n');
          this.advance();
          break;
        case 'indent':
          text.push(this.parseTextBlock().map(function(text){
            return '  ' + text;
          }).join('\\n'));
          break;
        default:
          text.push(this.advance().val);
      }
    }
    this.expect('outdent');
    return text;
  },

  /**
   * indent expr* outdent
   */
  
  parseBlock: function(){
    var block = new nodes.Block;
    block.line = this.line();
    this.expect('indent');
    while ('outdent' != this.peek().type) {
      if ('newline' == this.peek().type) {
        this.advance();
      } else {
        block.push(this.parseExpr());
      }
    }
    this.expect('outdent');
    return block;
  },

  /**
   * tag (attrs | class | id)* (text | code | ':')? newline* block?
   */
  
  parseTag: function(){
    var name = this.advance().val
      , tag = new nodes.Tag(name);

    tag.line = this.line();

    // (attrs | class | id)*
    out:
      while (true) {
        switch (this.peek().type) {
          case 'id':
          case 'class':
            var tok = this.advance();
            tag.setAttribute(tok.type, "'" + tok.val + "'");
            continue;
          case 'attrs':
            var obj = this.advance().attrs
              , names = Object.keys(obj);
            for (var i = 0, len = names.length; i < len; ++i) {
              var name = names[i]
                , val = obj[name];
              tag.setAttribute(name, val);
            }
            continue;
          default:
            break out;
        }
      }

    // check immediate '.'
    if ('.' == this.peek().val) {
      tag.textOnly = true;
      this.advance();
    }

    // (text | code | ':')?
    switch (this.peek().type) {
      case 'text':
        tag.text = this.parseText();
        break;
      case 'code':
        tag.code = this.parseCode();
        break;
      case ':':
        this.advance();
        tag.block = new nodes.Block;
        tag.block.push(this.parseTag());
        break;
    }

    // newline*
    while (this.peek().type === 'newline') this.advance();

    // Assume newline when tag followed by text
    if (this.peek().type === 'text') {
      if (tag.text) tag.text.push('\\n');
      else tag.text = new nodes.Text('\\n');
    }

    tag.textOnly = tag.textOnly || ~textOnly.indexOf(tag.name);

    // script special-case
    if ('script' == tag.name) {
      var type = tag.getAttribute('type');
      if (type && 'text/javascript' != type.replace(/^['"]|['"]$/g, '')) {
        tag.textOnly = false;
      }
    }

    // block?
    if ('indent' == this.peek().type) {
      if (tag.textOnly) {
        this.lexer.textPipe = false;
        tag.block = this.parseTextBlock();
        this.lexer.textPipe = true;
      } else {
        var block = this.parseBlock();
        if (tag.block) {
          for (var i = 0, len = block.length; i < len; ++i) {
            tag.block.push(block[i]);
          }
        } else {
          tag.block = block;
        }
      }
    }
    
    return tag;
  }
};

// end module: jade/lib/parser.js
});
;

require.module('jade/lib/self-closing.js', function(module, exports, require) {
// start module: jade/lib/self-closing.js


/*!
 * Jade - self closing tags
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

module.exports = [
    'meta'
  , 'img'
  , 'link'
  , 'input'
  , 'area'
  , 'base'
  , 'col'
  , 'br'
  , 'hr'
];

// end module: jade/lib/self-closing.js
});
;

require.module('jade/lib/utils.js', function(module, exports, require) {
// start module: jade/lib/utils.js


/*!
 * Jade - utils
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Convert interpolation in the given string to JavaScript.
 *
 * @param {String} str
 * @return {String}
 * @api private
 */

var interpolate = exports.interpolate = function(str){
  return str.replace(/(\\)?([#$!]){(.*?)}/g, function(str, escape, flag, code){
    return escape
      ? str
      : "' + "
        + ('!' == flag ? '' : 'escape')
        + "((interp = " + code.replace(/\\'/g, "'")
        + ") == null ? '' : interp) + '";
  });
};

/**
 * Escape single quotes in `str`.
 *
 * @param {String} str
 * @return {String}
 * @api private
 */

var escape = exports.escape = function(str) {
  return str.replace(/'/g, "\\'");
};

/**
 * Interpolate, and escape the given `str`.
 *
 * @param {String} str
 * @return {String}
 * @api private
 */

exports.text = function(str){
  return interpolate(escape(str));
};

// end module: jade/lib/utils.js
});
;

require.module('jade/index.js', function(module, exports, require) {
// start module: jade/index.js


module.exports = require('./lib/jade');

// end module: jade/index.js
});
;

