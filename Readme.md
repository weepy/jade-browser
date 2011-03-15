jade browser
============

this is a test project to try to build jade for the browser using brequire.

running
------

open index.html in a browser


build
------

<pre>node build.js</pre>

will build <code>jade.js</code> using brequire

shim.js contain any necessary missing components, currently it consists of:

* an empty module for 'fs'
* definition for Object.keys


potential problems
-----------
* browsers that don't support __proto__

denendencies
------------

npm install brequire jade

latest npm, brequire
