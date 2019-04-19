"use strict";

require("source-map-support/register");

/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
require('@babel/register')({
  extensions: ['.ts', '.js']
});

require('./daemon.ts');
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zZXJ2aWNlL2Rldi5zdGFydC5qcyJdLCJuYW1lcyI6WyJyZXF1aXJlIiwiZXh0ZW5zaW9ucyJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBOzs7Ozs7Ozs7QUFVQUEsT0FBTyxDQUFDLGlCQUFELENBQVAsQ0FBMkI7QUFDekJDLEVBQUFBLFVBQVUsRUFBRSxDQUFDLEtBQUQsRUFBUSxLQUFSO0FBRGEsQ0FBM0I7O0FBR0FELE9BQU8sQ0FBQyxhQUFELENBQVAiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCAoYykgMjAxOS4gTmF0YS1JbmZvXG4gKiBAYXV0aG9yIEFuZHJlaSBTYXJha2VldiA8YXZzQG5hdGEtaW5mby5ydT5cbiAqXG4gKiBUaGlzIGZpbGUgaXMgcGFydCBvZiB0aGUgXCJAbmF0YVwiIHByb2plY3QuXG4gKiBGb3IgdGhlIGZ1bGwgY29weXJpZ2h0IGFuZCBsaWNlbnNlIGluZm9ybWF0aW9uLCBwbGVhc2Ugdmlld1xuICogdGhlIEVVTEEgZmlsZSB0aGF0IHdhcyBkaXN0cmlidXRlZCB3aXRoIHRoaXMgc291cmNlIGNvZGUuXG4gKi9cblxucmVxdWlyZSgnQGJhYmVsL3JlZ2lzdGVyJykoe1xuICBleHRlbnNpb25zOiBbJy50cycsICcuanMnXSxcbn0pO1xucmVxdWlyZSgnLi9kYWVtb24udHMnKTtcbiJdfQ==