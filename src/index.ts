import { 
	execute, 
	javascript, 
	GlobalState, 
	ComponentFromConfig, 
	Component,
	Tag,
	WRAP,
	MATCH,
	BoxProp,
	ProgrammingLanguage,
	javascriptBundle,
	Alignment,
	props,
	getDependencies,
	compile,
	stubs,
	EventConfig,
	Theme,
	fixed,
	clip,
	observe,
	block,
	set,
	condition,
	position,
	column,
	padding,
	index as setIndex,
	background,
	clientOnly,
	indexes,
	id,
	eq,
} from "polygraphic";
import { DocumentOutput, Manifest, TagProps } from "./types";
export * from "./types";
import moment from "moment";
import { compile as compileHB } from "handlebars";
import showdown from "showdown";
import { minify as minifyHtml } from "html-minifier";
import CleanCss from "clean-css";
import UglifyJS from "uglify-js";
import {escape as escapeHtml} from "html-escaper";
import { parse as parseHTML } from "node-html-parser";
import hljs from "highlight.js";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import packageJSON from "../package.json";

const hljsCSS = `
pre code.hljs {
    display: block;
    overflow-x: auto;
    padding: 1em
}
code.hljs {
    padding: 3px 5px
}
.hljs {
    background: #f3f3f3;
    color: #444
}
.hljs-comment {
    color: #697070
}
.hljs-punctuation,.hljs-tag {
    color: #444a
}
.hljs-tag .hljs-attr,.hljs-tag .hljs-name {
    color: #444
}
.hljs-attribute,.hljs-doctag,.hljs-keyword,.hljs-meta .hljs-keyword,.hljs-name,.hljs-selector-tag {
    font-weight: 700
}
.hljs-deletion,.hljs-number,.hljs-quote,.hljs-selector-class,.hljs-selector-id,.hljs-string,.hljs-template-tag,.hljs-type {
    color: #800
}
.hljs-section,.hljs-title {
    color: #800;
    font-weight: 700
}
.hljs-link,.hljs-operator,.hljs-regexp,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-symbol,.hljs-template-variable,.hljs-variable {
    color: #ab5656
}
.hljs-literal {
    color: #695
}
.hljs-addition,.hljs-built_in,.hljs-bullet,.hljs-code {
    color: #397300
}
.hljs-meta {
    color: #1f7199
}
.hljs-meta .hljs-string {
    color: #38a
}
.hljs-emphasis {
    font-style: italic
}
.hljs-strong {
    font-weight: 700
}
`;

const VERSION = packageJSON.version;

const handlebars = (input : string, data : unknown) => {
	const template = compileHB(input);
	return template(data);
};

const TIMEOUT = 300;

const getDisplay = <Global extends GlobalState, Local>(component : Component<Global, Local>) : string => {
	switch(component.name) {	
	case "h1": //text
	case "h2":
	case "h3":
	case "p":
	case "checkbox":  //input
	case "textarea":
	case "date":
	case "number":
	case "input":
	case "option":
	case "select":
	case "progress":
	case "scrollable":
	case "stack":
	case "editor":
	case "content":
	case "canvas":
		return "block";
	case "button":
	case "column":
	case "fixed":
	case "flex":
	case "footer":
	case "header":
	case "main":
	case "nav":
	case "root":
	case "section":
	case "row":
		return "flex";
	case "grid":
		return "grid";
	case "text":
	case "anchor":
	case "image":
	case "iframe":
		return "inline-block";
	}
};

const minifyCss = (css : string, minify : boolean) : string => {
	if(minify) {
		const clean = new CleanCss().minify(css);
		if(clean.errors.length || clean.warnings.length) {
			return `/** errors and warnings:
	${clean.warnings.concat(clean.errors).join("\n\t")}
*/${css}`;
		} else {
			return clean.styles;
		}
	}
	return css;
};

const minifyJs = (js : string, minify : boolean) : string => {
	if(minify) {
		const result = UglifyJS.minify(js);
		if(result.error) {
			return `console.error(${JSON.stringify({
				name : result.error.name,
				message : result.error.message,
				stack : result.error.stack,
			})});\n${js}`;
		}
		return result.code;
	}
	return js;
};

const eventDependency = (name : string, code : string, output : DocumentOutput) => {
	if(output.cache.has(`dependency:${name}`)) return;
	output.cache.add(`dependency:${name}`);
	output.js.push(`events["${name}"] = function(component, local, callback) {
${code}
};`);
};

const generateDependencies = (output : DocumentOutput) => {
	return Array.from(output.dependencies).map(dependency => {
		switch(dependency) {
		case "handlebars":
			return `var handlebars = function(input, data) {
	return Handlebars.compile(input)(data);
}`;
		case "onChange":
			return eventDependency("onChange", `
if(component.dataset.editor) {
	var editor = component.quill;
	if(!editor) {
		// LINK 
		var Link = Quill.import("formats/link");				
		class LinkFormat extends Link {
			static create(value) {
				var node = super.create();
				node.setAttribute("href", value);
				node.setAttribute("rel", "noreferrer");
				return node;
			}
		}
		Quill.register(LinkFormat, true);
		// COUNTER
		class WordCount {
			constructor(quill, props) {
				this.quill = quill;
				this.props = props;
				this.container = this.quill.container;
				this.quill.on('text-change', this.update.bind(this));
				this.toolbar = quill.getModule('toolbar');
				this.update();  // Account for initial contents
			}
		
			calculate(){
				let text = this.quill.getText();
				text = text.trim();
				// Splitting empty text returns a non-empty array
				return text.length > 0 ? text.split(/\\s+/).length : 0;
			}
		
			update() {
				let length = this.calculate();
				let label = 'word';
				if (length !== 1) {
					label += 's';
				}
				this.toolbar = this.quill.getModule('toolbar');
				let countView = document.getElementById('quill-word-count');
				if (!countView) {
					let countView = document.createElement('span');
					countView.id = 'quill-word-count';
					this.toolbar.container.appendChild(countView);
					countView.innerHTML = length + ' ' + label;
				}
				else{
					countView = document.getElementById('quill-word-count');
					countView.innerHTML = length + ' ' + label;
				}
			}
		}
		Quill.register('modules/wordCount', WordCount);
		// IMAGE
		var BlockEmbed = Quill.import("blots/block/embed");		
		class ImageBlot extends BlockEmbed {
			static create(value) {
				var node = super.create();
				var src = value.src || value;
				if(src.startsWith("data:image/")) {
					node.src = src;
					windowFetch(src).then(function (res){
						return res.arrayBuffer().then(function (buffer) {
							var type = src.slice("data:".length, src.indexOf(";"));
							events[component.dataset.id].onDrop(
								local.value, 
								local.index, 
								[new File([buffer], "image." + type.split("/").pop(), {
									type
								})]
							).then(function(src) {
								node.src = src;
							});
						});
					})
				} else {
					node.src = src;
					node.alt = value.alt;
				}
				return node;
			}
			static value(node) {
				return {
					src : node.src,
					alt : node.alt,
				};
			}
		}
		ImageBlot.blotName = 'image';
		ImageBlot.tagName = 'img';
		Quill.register(ImageBlot, true);
		// FULLSCREEN
		var Parchment = Quill.import("parchment");
		var FullScreen = new Parchment.Attributor.Class('fullscreen', 'ql-fullscreen', {
			scope: Parchment.Scope.INLINE
		});
		Quill.register(FullScreen, true);
		// CREATE
		editor = component.quill = new Quill(component, {
			modules: {
				syntax: true,
				wordCount: true,
				toolbar: [
					[{ 'header': [1, 2, 3, false] }],
					['bold', 'italic', 'underline', 'link', 'code'],
					[{ 'list': 'ordered' }, { 'list': 'bullet' }],
					['image', 'code-block'],
					["fullscreen"]
				]
			},
			theme: 'snow'
		});
		editor.root.addEventListener("contextmenu", function(e) {
			const image = Parchment.find(e.target);
			if (image instanceof ImageBlot) {
				const node = image.domNode;
				const alt = prompt(
					"Please provide an alt text for this image:", 
					node.hasAttribute("alt") ? node.alt : ""
				);
				if(typeof alt === "string") {
					node.alt = alt;
				}
				return prevent(e);
			}
		});
		component.parentNode.querySelector('.ql-fullscreen').addEventListener('click', function() {
			component.parentNode.requestFullscreen();
		});
	}
	if(component.quill.onTextChange) {
		editor.off("text-change", component.quill.onTextChange);
	}
	component.quill.onTextChange = function() {
		callback(local.value, local.index, editor.root.innerHTML);
		update();
	};
	editor.on("text-change", component.quill.onTextChange);
} else if(component.tagName.toLowerCase() === "select") {
	component.onchange = function() {					
		var value = this.value;
		protect(function() {
			callback(local.value, local.index, value);
			update();
		});
	};
} else if(component.type === "checkbox") {
	component.onclick = function() {					
		var checked = this.checked;
		protect(function() {
			callback(local.value, local.index, checked);
			update();
		});
	};
} else if(component.type === "date") {
	component.oninput = function() {					
		var value = this.valueAsDate;
		if(value) {
			var date = new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
			callback(local.value, local.index, date.getTime());
		} else {
			callback(local.value, local.index, -1);
		}
		update();
	};
} else {
	component.oninput = function() {				
		var value = this.value || this.innerText;	
		if(this.type === "number") {
			value = this.valueAsNumber;
		}				
		callback(local.value, local.index, value);
		update();
	};
}`, output);
		case "onEnter":
			return eventDependency("onEnter", `			
component.onkeypress = function(e) {					
	if(e.which === 13) {
		protect(function() {
			callback(local.value, local.index);
			update();
		});
	}
};`, output);
		case "onInit":
			return eventDependency("onInit", `
callback(local.value, local.index);
update();`, output);
		case "onResize":
			return eventDependency("onResize", `
component.onResize = function() {
	var rect = component.getBoundingClientRect();
	callback(local.value, local.index, {
		x : fallback(rect.x, rect.left),
		y : fallback(rect.y, rect.top),
		width: rect.width,
		height: rect.height,
	});
	update();
};
var observer = new ResizeObserver(component.onResize);
observer.observe(component);`, output);
		case "onDrop":
			return eventDependency("onDrop", `
function getFiles(event) {
	if (event.dataTransfer.items) {
		return Array.from(event.dataTransfer.items).filter(function(item) {
			return item.kind === 'file';
		}).map(function(item) {
			return item.getAsFile();
		})
	} else {
		return Array.from(event.dataTransfer.files);
	}
}
component.ondragenter = prevent
component.ondragleave = prevent
component.ondragover = prevent
component.ondrop = function(event) {
	if(component.dataset.editor) {
		const reader = new FileReader();
		reader.addEventListener("load", function () {
		  component.quill.insertEmbed(component.quill.getSelection().index, 'image', reader.result, 'user');
		  update();
		}, false);
		reader.readAsDataURL(getFiles(event)[0]);
	} else {
		callback(local.value, local.index, getFiles(event));
		update();
	}
	return prevent(event);
};`, output);
		case "onWebSocketOpen":
			return eventDependency(dependency, `
socket.on("open", function() {
	callback(local.value, local.index/*,event*/);
	update();
});`, output);
		case "onWebSocketMessage":
			return eventDependency(dependency, `
socket.on("message", function(event) {
	callback(local.value, local.index, JSON.parse(event.data));
	update();
});`, output);
		case "onWebSocketClose":
			return eventDependency(dependency, `
socket.on("close", function() {
	callback(local.value, local.index/*,event*/);
	update();
});`, output);
		case "onWebSocketError":
			return eventDependency(dependency, `
socket.on("error", function(error) {
	callback(local.value, local.index, error);
	update();
});`, output);
		case "onClick":
			return eventDependency("onClick", `			
component.onclick = function() {
	protect(function() {
		callback(local.value, local.index/*,event*/);
		update();
	})
};`, output);
		case "onContext":
			return eventDependency("onContext", `	
component.style.userSelect = "none";
component.oncontextmenu = function(e) {
	protect(function() {
		callback(local.value, local.index/*,event*/);
		update();
	})
	return prevent(e);
};`, output);
		case "observe":
			return eventDependency("observe", `
	var wrapped = Component(component);
	var listener;
	for(var i = 0; i < listeners.length; i++) {
		if(listeners[i].raw === component) {
			listener = listeners[i];
			break;
		}
	}
	if(!listener) {
		listener = {
			raw : component,
			component : wrapped,
			callback : callback,
			local : local,
			id : component.dataset.id
		}
		listeners.push(listener);
		setTimeout(function() {
			callback(listener.local.value, listener.local.index, wrapped)
		});
	} else {
		listener.local = local;
	}
	`, output);
		}
	}).filter(_ => _).join("\n");
};

const converter = new showdown.Converter();

const sharedJs = (output : DocumentOutput) => minifyJs(`var windowSetTimeout = window.setTimeout;
var onUpdate = [];
var events = {};
function prevent(e) {
	e.preventDefault();
	e.stopPropagation();
	e.cancelBubble = true;
	return false;
}
function setEvent(id, name, callback) {
	events[id] = events[id] || {};
	events[id][name] = callback;
}
var protect = (function() {
	var last = 0;
	return function(callback) {
		var now = Date.now();
		if(now - last >= ${TIMEOUT}) {
			last = now;
			callback();
		}
	};
})();
function Local(value, index) {
	return {
		value : value,
		index : index
	};
}
var adapters = {};
var listeners = [];
var isMobile = /mobi/i.test(window.navigator.userAgent);
function $(html) {
	var div = document.createElement("div");
	div.innerHTML = html;
	var child = div.children[0];
	return function() {
		return child.cloneNode(true);
	};
}
function numberToMeasurement(input) {
	if(!input) {
		return "0";
	}
	if(typeof input === "string") {
		return input;
	}
	if(-1 < input && input < 1) {
		return (input * 100) + "%";
	} else if(input === ${WRAP}) {
		return "auto";
	} else if(input === ${MATCH}) {
		return "100%";
	} else {
		return input + "px";
	}
}
var getImage = (function() {
	var images = {};
	return function(src) {
		var promise = images[src];
		if(!promise) {
			promise = windowFetch(src).then(function(res) {
				return res.blob();
			}).then(function(buffer) {
				return URL.createObjectURL(buffer);
			});
		}
		images[src] = promise;
		return promise;
	}
})();
function Component(component) {
	var cache = {};
	return new Proxy(component, {
		get : function(target, key) {
			if(key === "onResize") {
				return component.onResize;
			}
			if(key === "isMounted") {
				return document.body.contains(component);
			}
		},
		set : function(target, key, value) {
			if(!(key in cache) || cache[key] !== value) {
				cache[key] = value;
				switch(key) {
					case "title":
						document.querySelector("title").innerText = value;
						return;
					case "metas":
						Object.keys(value).forEach(function(key) {
							var meta = document.querySelector("meta[name='" + key + "']");
							if(!meta) {
								meta = document.createElement("meta");
								document.head.appendChild(meta);
								meta.name = key;
							}
							meta.content = value[key];
						});
						return;
					case "links":
						Object.keys(value).forEach(function(key) {
							var link = document.querySelector("link[rel='" + key + "']");
							if(!link) {
								link = document.createElement("link");
								document.head.appendChild(link);
								link.rel = key;
							}
							link.href = value[key];
						});
						return;
					case "border":
						target.style.border = "none";
						Object.keys(value || {}).forEach(function(side) {
							var key = "border" + side[0].toUpperCase() + side.slice(1);
							var val = [numberToMeasurement(value[side][0]), value[side][1], value[side][2]].join(" ");
							target.style[key] = val;
						});
						return;
					case "editable":
						target.contentEditable = value;
						return;
					case "rotate":
						windowSetTimeout(() => {
							target.style.transform = "rotate(" + value + "deg)";
						});
						target.style.transition = "transform ${TIMEOUT}ms";
						return;
					case "translate":
						windowSetTimeout(() => {
							target.style.transform = "translate(" + numberToMeasurement(value.x) + "," + numberToMeasurement(value.y) + ")";
						});
						target.style.transition = "transform ${TIMEOUT}ms";
						return;
					case "draw":
						var context = target.getContext("2d");
						target.width = value.width;
						target.height = value.height;
						value.content.reduce(function(promise, item) {
							var translate = item.translate || {};
							return promise.then(function() {
								var width = item.width,
									height = item.height,
									x = typeof item.left === "number" ? item.left :
										typeof item.right === "number" ? value.width - width - item.right :
										item.x,									
									y = typeof item.top === "number" ? item.top :
										typeof item.bottom === "number" ? value.height - height - item.bottom :
										item.y;
								context.fillStyle = item.fill || "transparent";
								context.strokeStyle = item.stroke || "transparent";
								if(item.type === "image") {
									return getImage(item.src).then(function(src) {
										return new Promise(function(resolve) {
											var image = new Image();
											image.onload = function() {
												if(!width && !height) {
													width = image.width;
													height = image.height;
												} else if(!width) {
													width = image.width * height / image.height;
												} else if(!height) {
													height = image.height * width / image.hwidth;
												}
												if(!x) {
													x = typeof item.left === "number" ? item.left :
														typeof item.right === "number" ? value.width - width - item.right :
														item.x;
												}
												if(!y) {												
													y = typeof item.top === "number" ? item.top :
														typeof item.bottom === "number" ? value.height - height - item.bottom :
														item.y;
												}
												context.save();
												context.translate((translate.x || 0) * width, (translate.y || 0) * height);
												context.drawImage(image, x, y, width, height);
												context.restore();
												resolve();
											};
											image.src = src;
										})
									});
								} else if(item.type === "rect") {
									context.save();
									context.translate((translate.x || 0) * width, (translate.y || 0) * height);
									if(item.round) {
										context.beginPath();
										context.moveTo(x + item.round, y);
										context.lineTo(x + width - item.round, y);
										context.quadraticCurveTo(x + width, y, x + width, y + item.round);
										context.lineTo(x + width, y + height - item.round);
										context.quadraticCurveTo(x + width, y + height, x + width - item.round, y + height);
										context.lineTo(x + item.round, y + height);
										context.quadraticCurveTo(x, y + height, x, y + height - item.round);
										context.lineTo(x, y + item.round);
										context.quadraticCurveTo(x, y, x + item.round, y);
										context.closePath();
									} else {
										context.rect(x, y, width, height);
									}
									context.fill();
									context.stroke();
									context.restore();
								} else if(item.type === "text") {
									context.save();
									context.translate((translate.x || 0) * width, (translate.y || 0) * height);
									context.font = (item.size || 16) + "px " + (item.family || "Courier New");
									context.textBaseline = item.baseline || "top";
									context.textAlign = item.align || "start";
									context.fillText(item.text, x, y);
									context.strokeText(item.text, x, y);
									context.restore();
								}
							});
						}, Promise.resolve());
						return;
					case "src":
						if(value) {
							if(new URL(value, location).pathname !== new URL(target.src, location).pathname) {
								getImage(value).then(function(src) {
									target.src = src;
								}).catch(function() {
									document.body.removeAttribute("src");
								});
							}
						} else {
							document.body.removeAttribute("src");
						}
						return;
					case "clickable":
						target.style.pointerEvents = value ? "auto" : "none";
						return;
					case "width":
					case "height":
						windowSetTimeout(function() {
							target.style[key] = numberToMeasurement(value);
						});
						target.style.transition = key + " ${TIMEOUT}ms";
						return;
					case "resize":		
						if(value) {
							component.onResize();
						}
						return;
					case "focus":
						windowSetTimeout(function() {
							target.focus();
							target.setSelectionRange(0, target.value.length);
						}, ${TIMEOUT});
						return;
					case "opacity":
						windowSetTimeout(function() {
							target.style.opacity = value;
						});
						target.style.transition = "opacity ${TIMEOUT}ms";
						return;
					case "enabled":
						target.disabled = !value;
						return;
					case "placeholder":
						target.placeholder = value;
						return;
					case "animation":
						if(!value) return;
						function render() {
							var progress = Math.max(Math.min((Date.now() - value.start) / ${TIMEOUT}, 1), 0)
							if(progress < 1) {
								requestAnimationFrame(render);
							}
							if(value.direction === "in" && value.name === "right") {
								target.style.transform = "translateX(" + (100 - 100 * progress) + "%)";
							}
							if(value.direction === "out" && value.name === "right") {
								target.style.transform = "translateX(" + (100 * progress) + "%)";
							}
							if(value.direction === "in" && value.name === "left") {
								target.style.transform = "translateX(" + (-100 + 100 * progress) + "%)";
							}
							if(value.direction === "out" && value.name === "left") {
								target.style.transform = "translateX(" + (-100 * progress) + "%)";
							}
							if(value.direction === "in" && value.name === "opacity") {
								target.style.opacity = progress;
							}
							if(value.direction === "out" && value.name === "opacity") {
								target.style.opacity = (1 - progress);
							}
						}
						render();
						return;
					case "value":
						if(value === undefined || value === null) {
							value = "";
						}
						if(target.dataset.editor) {
							var editor = target.quill;
							if(editor.root !== document.activeElement) {
								editor.root.innerHTML = value;
							}
						} else if(target !== document.activeElement) {
							if(target.type === "date") {
								if(value === -1) {
									target.valueAsDate = null;
								} else {
									var local = new Date(value);
									target.valueAsDate = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
								}
							} else if(target.type === "checkbox") {
								target.checked = value;
							} else {
								target.value = value;
							}
						}
						return;
					case "html":
						if(target !== document.activeElement) {
							if(value === undefined || value === null) {
								value = "";
							}
							target.innerHTML = value;
						}
						return;
					case "href":
						target.href = value;
						return;
					case "text":
						if(target !== document.activeElement) {
							if(value === undefined || value === null) {
								value = "";
							}
							target.innerText = value;
						}
						return;
					case "data":
						var prev = cache.prevData || [];
						if(!value) {
							return;
						}
						var curr = value.map(function(it) {
							return "id" in it ? it.id : it.key;
						});
						if(!cache.prevData && value.length === target.children.length) { // we need to hydrate
							for(var i = 0; i < target.children.length; i++) {
								var item = value[i];
								bind(target.children[i], Local(item, i))
							}
						} else {
							if(!cache.prevData) {
								target.innerHTML = "";
							}
							// REMOVE
							var removed = [];
							for(var i = prev.length - 1; i >= 0; i--) {
								if(!curr.includes(prev[i])) {
									prev.splice(i, 1);
									removed.push(target.removeChild(target.children[i]));
								}
							}
							// ADD
							for(var i = 0; i < curr.length; i++) {
								if(!prev.includes(curr[i])) {
									var item = value[i];
									// TODO : ATTEMPT TO REUSE REMOVED COMPONENTS
									var child = adapters[target.dataset.id + "_" + item.adapter]();
									bind(child, Local(item, i))
									if(i < target.children.length) {
										target.insertBefore(child, target.children[i]);
									} else {
										target.appendChild(child);
									}
								}
							}
							// MOVE / UPDATE
							for(var i = 0; i < target.children.length; i++) {
								target.children[i].__local__.value = value[i];
								target.children[i].__local__.index = i;
							}
						}
						cache.prevData = curr;
						windowSetTimeout(function() {
							target.value = cache.value;
						});
						return;
					case "position":
						var shouldTransition = target.style.top || target.style.right || target.style.bottom || target.style.left;
						target.style.top = typeof value.top === "number" ? value.top + "px" : "auto";
						target.style.right = typeof value.right === "number" ? value.right + "px" : "auto";
						target.style.bottom = typeof value.bottom === "number" ? value.bottom + "px" : "auto";
						target.style.left = typeof value.left === "number" ? value.left + "px" : "auto";
						if(shouldTransition) {
							target.style.transition = "top ${TIMEOUT}ms, right ${TIMEOUT}ms, bottom ${TIMEOUT}ms, left ${TIMEOUT}ms";
						}
						return;
					case "background":
						target.style.background = value;
						return;
					case "visible":
						target.style.display = value ? target.dataset.display : "none";
						return;
					case "markdown":
						target.innerHTML = converter.makeHtml(value);
						return;
				}
			}
		}
	});
}
var update = (function() {
	var timeout;
	return function() {
		clearTimeout(timeout);
		timeout = windowSetTimeout(function() {
			listeners.forEach(function (listener) {
				listener.callback(listener.local.value, listener.local.index, listener.component)
			});        
			listeners = listeners.filter(function(listener) {
				return listener.component.isMounted;
			});
			onUpdate.forEach(function(callback) {
				callback();
			});
		});
	}
})();
function bind(root, local) {
	root.__local__ = local;
	Array.from(root.querySelectorAll("[data-id]")).concat(root.dataset.id ? [root] : []).forEach(function(component) {
		var toBind = events[component.dataset.id];
		if(!toBind) return;
		Object.keys(toBind).forEach(function(event) {
			var callback = toBind[event];
			events[event](component, local, callback);
			if(event === "onDragStart") {
				component.ondragstart = function() {
					callback(local.value, local.index);
					update();
				};
			} else if(event === "onDragEnd") {
				component.ondragend = function() {
					callback(local.value, local.index);
					update();
				};
			}
		});
	});
}
`, !!output.minify);

const sharedCss = (output : DocumentOutput) => minifyCss(`html, body {
	display : flex;
	width : 100%;
	min-height : 100%;
}
.grecaptcha-badge {
	opacity : 0;
}
* { 
	box-sizing: border-box;
	font-family: '${output.font || "Roboto"}', sans-serif;
	font-size : 16px;
	font-stretch : 100%;
	font-style : normal;
	font-weight : 400;
}
.ql-editor p, .ql-editor h1, .ql-editor h2, .ql-editor h3, .ql-editor ul, .ql-editor ol, .ql-editor img, .ql-editor pre,
.content p, .content h1, .content h2, .content h3, .content ul, .content ol, .content img, .content pre {
	margin : 0;
	margin-top : 16px;
}
.ql-editor img, 
.content img {
	object-fit : contain;
	width : 100%;
	height : 240px;
}
@media screen and (min-width: 800px) {
	.ql-editor img, .content img {
		height : 480px;
	}	
}
.ql-editor code, 
.content code {
	color : black;
    padding: 2px 4px;
    background-color: #f0f0f0;
    border-radius: 3px;
}
.ql-editor pre, 
.content pre {
	overflow : auto;
}
button {
	cursor : pointer;
	text-align : start;
}
textarea, select, input, button, html, body, nav, footer, header, main, section, h1, h2, h3, p, a {
	background : transparent;
	margin : 0;
	padding : 0;
	border : 0;
	text-decoration : none;
}
.progress {
	border: 3px solid transparent;
	border-radius: 50%;
	animation: spin 1s ease-in-out infinite;
	-webkit-animation: spin 1s ease-in-out infinite;
}
@keyframes spin {
	to { -webkit-transform: rotate(360deg); }
}
@-webkit-keyframes spin {
	to { -webkit-transform: rotate(360deg); }
}`, !!output.minify);

const localCss = (output : DocumentOutput) => {
	return minifyCss(Object.keys(output.css.queries).map(query => {
		return `${query}{\n\t${
			Object.keys(output.css.queries?.[query] || {}).map(className => {
				return `${className}{${
					Object.keys(output.css.queries?.[query]?.[className] || {}).map(styleName => {
						return `${styleName}:${output.css.queries?.[query]?.[className]?.[styleName]}`;
					}).join(";")}}`;
			}).join("\n\t")}}`;
	}).join("\n"), !!output.minify);
};

export const html = <Global extends GlobalState, Local>({
	root,
	name,
	uuid,
	isAmp,
	minify = false
} : {
	root : ComponentFromConfig<Global, Local>,
	name : string,
	uuid : string,
	isAmp?: boolean
	minify?: boolean
}) => (
		generateState : (event : EventConfig<GlobalState, null, null>) => Global & Local
	) : Record<string, string | Buffer> => {
		const result = json({
			root,
			name,
			uuid,
			isAmp,
			minify
		})(generateState);
		const files : Record<string, string | Buffer> = {			
			[`${name}.html`] : minify ? minifyHtml(document(result), {
				collapseWhitespace: true,
			}) : document(result),
			...(isAmp ? {} : {
				[`shared.css?q=${VERSION}`] : sharedCss(result),
				[`${name}.css?q=${uuid}`] : localCss(result),
				...(result.js.length ? {
					[`shared.js?q=${VERSION}`] : sharedJs(result),
					[`${name}.js?q=${uuid}`] : minifyJs(result.js.join("\n") + `bind(document.body, Local(global, 0));${result.analytics ? `
	window.dataLayer = window.dataLayer || [];
	function gtag(){dataLayer.push(arguments);}
	gtag("js", new Date());
	gtag("config", "${result.analytics}");` : ""}
					`, minify),
				} : {})
			}),
		};
		if(result.manifest) {
			const manifest = result.manifest;
			files[`${name}-manifest.json`] = JSON.stringify(manifest, null, "\t");
			files[`${name}-service-worker.js`] = minifyJs(`
var cacheName = "${name}";
self.addEventListener("install", function(event) {
	event.waitUntil(
		caches.open(cacheName).then(function(cache) {
			return cache.addAll([
				${Object.keys(files).map(it => `"${it}"`).join(",\n\t\t\t\t")}
			]);
		})
	);
	self.skipWaiting();
});
self.addEventListener("activate", function(event) {
	event.waitUntil(
		caches.keys().then(function(cacheNames) {
			return Promise.all(cacheNames.map(function(cacheName) {
				return caches.delete(cacheName);
			}));
		})
	);
});
self.addEventListener("fetch", function(event) {
	event.respondWith(
		caches.open(cacheName).then(function(cache) {
			return fetch(event.request).then(function(response) {
				if(event.request.method.toLowerCase() === "get") {
					cache.put(event.request, response.clone());
				}
				return response;
			}).catch(function() {
				return cache.match(event.request);
			})
		})
	);
});`, minify);
	
		}
		return files;
	};

const scripts = [{
	dependency : "handlebars",
	src : "https://cdnjs.cloudflare.com/ajax/libs/handlebars.js/4.7.7/handlebars.min.js",
}, {
	dependency : "quill",
	src : "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.6.0/highlight.min.js"
}, {
	dependency : "quill",
	src : "https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.min.js",
}, {
	dependency : "moment",	
	src : "https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.4/moment.min.js",
}, {
	dependency : "event.markdown",
	src : "https://cdnjs.cloudflare.com/ajax/libs/showdown/2.0.3/showdown.min.js"
}];

const stylesheets = [{
	dependency : "quill",
	href : "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.6.0/styles/default.min.css",
}, {
	dependency : "quill",
	href : "https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.snow.min.css",
}];

const json = <Global extends GlobalState, Local>({
	root,
	name,
	uuid,
	isAmp,
	minify
} : {
	root : ComponentFromConfig<Global, Local>,
	name : string,
	uuid : string
	isAmp?: boolean
	minify?: boolean
}) => (
		
		generateState : (event : EventConfig<GlobalState, null, null>) => Global & Local
	) : DocumentOutput => { 
		const dependencies = new Set<string>([]);
		const generated = compile(generateState as unknown as (config : any) => ProgrammingLanguage, dependencies);
		const state = execute(generated, {
			...stubs,
			moment,
			handlebars
		}) as Global & Local;
		state.ui = {};
		state.features = ["speech.listen"];
		const component = root({
			parent : {
				width : MATCH,
				height : MATCH,
				name : "root"
			},
			global : state,
			local : state
		});
		const output : DocumentOutput = {
			drawer : "",
			minify,
			isAmp,
			uuid,
			font : "",
			name,
			analytics : "",
			recaptcha : "",
			dependencies,
			js : [],
			head : {
				title : "",
				links: {},
				metas: {}
			},
			css : {
				psuedo : "",
				cache : {},
				letter : "a",
				queries : {},
				query : "@media all"
			},
			html : [],
			scripts : [],
			stylesheets : [],
			cache : new Set<string>([]),
		};
		handle({
			component,
			global: state,
			local : state,
			output,
			index : 0
		});
		if(output.js.length) {
			output.js.unshift(`${javascriptBundle(output.dependencies)}
${library(output.dependencies)}
${generateDependencies(output)}
${output.manifest ? `
if ("serviceWorker" in navigator) {
	window.addEventListener("load", function() {
		navigator.serviceWorker.register("${name}-service-worker.js", {
			scope: "${output.manifest.start_url}"
		}).then(function(registration) {
			console.log("Registration successful, scope is:", registration);
		}).catch(function(error) {
			console.log("Service worker registration failed, error:", error);
		});
	});
}
` : ""}
var global = ${javascript(generated, "")};
global.os = "web";
${output.manifest ? `global = localStorage.${name} ? JSON.parse(localStorage.${name}) : global;` : ""}
${output.manifest ? `onUpdate.push(function() {
	localStorage.${name} = JSON.stringify(global);
});` : ""}
${output.dependencies.has("quill") ? `onUpdate.push(function() {
	Array.from(document.querySelectorAll(".content pre.ql-syntax")).forEach(function(element) {
		if(!element.classList.contains("hljs")) {
			hljs.highlightElement(element);
		}
	});
});` : ""}`);
		}
		scripts.forEach(script => {
			if(output.dependencies.has(script.dependency)) {
				output.scripts.push(script.src);
			}
		});
		stylesheets.forEach(stylesheet => {
			if(output.dependencies.has(stylesheet.dependency)) {
				output.stylesheets.push(stylesheet.href);
			}
		});
		return output;
	};

function failed(_ : never) {
	throw new Error("this should never happen");
}

const getTagName = (name : Tag, output : DocumentOutput) : {
    name : string
    selfClosing : boolean
} => {
	switch(name) {    
	case "section":  
	case "h1":  
	case "h2":  
	case "h3":  
	case "p":  
	case "header":  
	case "main":  
	case "footer":  
	case "nav":  
	case "option":
	case "select":
	case "button":
	case "iframe":
	case "textarea":
	case "canvas":
		return {
			name,
			selfClosing : false
		};
	case "text":
		return {
			name : "span",
			selfClosing : false
		};  
	case "anchor":
		return {
			name : "a",
			selfClosing : false
		};
	case "fixed":
	case "stack":
	case "grid":
	case "flex":
	case "progress":
	case "scrollable":
	case "row":
	case "root":
	case "column":
	case "editor":
	case "content":
		return {
			name : "div",
			selfClosing : false
		};
	case "date":
	case "checkbox":
	case "number":
	case "input":
		return {
			name : "input",
			selfClosing : true
		};
	case "image":
		return {
			name : output.isAmp ? "amp-img" : "img",
			selfClosing : !output.isAmp
		};
	}
};


const numberToMeasurement = (input : string | number | null | undefined) : string => {	
	if(!input) {
		return "0";
	}
	if(typeof input === "string") {
		return input;
	}
	if(-1 < input && input < 1) {
		return `${input * 100}%`;
	} else if(input === WRAP) {
		return "auto";
	} else if(input === MATCH) {
		return "100%";
	} else {
		return `${input}px`;
	}
};

const addClass = (name : string, value : string, output : DocumentOutput, props : TagProps) : TagProps => {
	const queryCache = output.css.query + output.css.psuedo;
	{ // remove conflicts
		const query = output.css.cache[queryCache] = output.css.cache[queryCache] || {};
		const style = query[name] = query[name] || {};
		// remove conflicts
		Object.keys(style).forEach(value => {
			const toRemove = style[value];
			if(toRemove && props.className.has(toRemove)) {
				props.className.delete(toRemove);
			}
		});
	}
	const cache = output.css.cache[queryCache]?.[name]?.[value];
	if(cache) {
		props.className.add(cache);
	} else {
		const letter = output.css.letter;
		{ // update the letter
			const next = letter.split("").map(it => it.charCodeAt(0) - "a".charCodeAt(0));
			next[0]++;
			for(let i = 0; i < next.length; i++) {
				if(next[i] === 26) {
					next[i] = 0;
					if(i + 1 === next.length) {
						next.push(0);
					} else {
						next[i + 1]++;
					}
				}
			}
			output.css.letter = next.map(it => it + "a".charCodeAt(0)).map(it => String.fromCharCode(it)).join("");
		}
		{ // set up the cache
			const query = output.css.cache[queryCache] = output.css.cache[queryCache] || {};
			const style = query[name] = query[name] || {};
			style[value] = letter;
		}
		{ // set up the output
			const query = output.css.queries[output.css.query] = output.css.queries[output.css.query] || {};
			const className = query["." + letter + output.css.psuedo] = query["." + letter + output.css.psuedo] || {};
			className[name] = value;
		}
		props.className.add(letter);
	}
	return props;
};
	
const handleBox = (
	prefix : string, 
	input : BoxProp<Array<unknown> | number>, 
	props : TagProps, 
	output : DocumentOutput
) : TagProps => {
	keys(input).forEach(key => {
		const value = input[key];
		if(value instanceof Array) {
			addClass(
				`${prefix}${key}`, 
				value.map(it => typeof it === "number" ? numberToMeasurement(it) : it).join(" "), 
				output,
				props
			);
		} else {
			addClass(
				`${prefix}${key}`,
				numberToMeasurement(value),
				output,
				props
			);
		}
	});
	return props;
};

const handleProp = <Global extends GlobalState, Local, Key extends keyof Component<Global, Local>>({
	component,
	name,
	value,
	props,
	output
} : {
    component : Component<Global, Local>
    name : Key
    value : Component<Global, Local>[Key]
    props : TagProps
	output : DocumentOutput
}) : TagProps => {
	switch(name) {
	case "on":
		if(output.isAmp) {
			props.on = value as string;
			props.role = "button";
			props.tabindex = "0";
		}
		return props;
	case "layout":
		if(output.isAmp) {
			props.layout = value as string;
		}
		return props;
	case "width":
	case "height":
		if(component.name === "image" && typeof value === "number" && value >= 0) {
			props[name] = `${value}`;
		}
		addClass(
			name,
			numberToMeasurement(value as string | number),
			output,
			props
		);
		return props;
	case "name": {
		addClass(
			"display",
			getDisplay(component),
			output,
			props
		);
		if(value === "iframe") {
			props.frameBorder = "0"; 
			props.allowFullScreen = "true";
		}
		if(value === "editor") {
			output.dependencies.add("quill");
			props["data-editor"] = "true";
			const all = output.css.queries["@media all"] = output.css.queries["@media all"] || {};
			const selector = ".ql-snow.ql-toolbar button.ql-fullscreen";
			const element = all[selector] = all[selector] || {};
			element["width"] = "auto";
			const after = all[`${selector}:after`] = all[`${selector}:after`] || {};
			after["content"] = "\"Fullscreen\"";
			addClass("flex-grow", "1", output, props);
		}
		if(value === "content") {
			props.className.add("content");
		}
		if(value === "fixed") {
			addClass(
				"position",
				"fixed",
				output,
				props
			);
		}
		if(value === "progress") {
			props.className.add("progress");
		}
		if(value === "stack") {
			addClass(
				"position",
				"relative",
				output,
				props
			);
		}
		if([
			"row", 
			"column"
		].includes(value as string)) {
			addClass(
				"flex-direction",
				value as string,
				output,
				props
			);
		}
		if(value === "date") {
			props.type = "date";
		}
		if(value === "scrollable") {
			addClass(
				"overflow",
				"auto",
				output,
				props
			);
		}
		if(value === "checkbox" || value === "number") {
			props.type = value as string;
		}
		return props;
	}
	case "ld":
		output.ld = value;
		return props;
	case "font":
		output.font = value as string;
		return props;
	case "background":
		return addClass(
			"background",
			value as string,
			output,
			props
		);
	case "grow":
		return addClass(
			"flex-grow",
			value ? "1" : "",
			output,
			props
		);
	case "id":
		if(value && !output.isAmp) {
			props["data-id"] = (value as unknown) as string;
		}
		return props;
	case "position":
		if(component.name !== "fixed") {
			addClass(
				"position",
				"absolute",
				output,
				props
			);
		}
		return handleBox("", value as BoxProp<number | Array<unknown>>, props, output);
	case "padding":
	case "margin":
	case "border":
		return handleBox(`${name}-`, value as BoxProp<number | Array<unknown>>, props, output);
	case "visible":
		props["data-display"] = getDisplay(component);
		addClass(
			"display",
			value ? getDisplay(component) : "none",
			output,
			props
		);
		return props;
	case "value":
		if(component.name === "date") {
			if(value !== -1) {
				props.value = moment(value as number).format("YYYY-MM-DD");
			}
		} else {
			props.value = value as string;
		}
		return props;
	case "placeholder":
		props.placeholder = ((value || "") as string);
		return props;
	case "enabled":
		props.disabled = value === false ? "disabled" : "";
		return props;
	case "onDragStart":
		props.draggable = "true";
		return props;
	case "color":
		if(component.name === "progress") {
			addClass(
				"border-top-color",
				value as string,
				output,
				props
			);
		} else {
			addClass(
				"color",
				value as string,
				output,
				props
			);
		}
		return props;
	case "size":
		return addClass(
			"font-size",
			`${value}px`,
			output,
			props
		);
	case "src":
		props.src = value as string;
		return props;
	case "crossAxisAlignment":
		return addClass(
			"align-items",
			value as Alignment,
			output,
			props
		);
	case "mainAxisAlignment":
		return addClass(
			"justify-content",
			value as Alignment,
			output,
			props
		);
	case "round":
		return addClass(
			"border-radius",
			numberToMeasurement(value as number),
			output,
			props
		);
	case "clip":
		if(value) {
			addClass(
				"overflow",
				"hidden",
				output,
				props
			);
		}
		return props;
	case "shadow":
		if(value) {
			addClass(
				"z-index",
				"1",
				output,
				props
			);
			addClass(
				"box-shadow",
				"#00000088 2px 2px 8px",
				output,
				props
			);
		}
		return props;
	case "opacity":
		return addClass(
			"opacity",
			`${value}`,
			output,
			props
		);
	case "alt":
		if(component.name === "image") {
			props.alt = value as string;
		} else {
			props["aria-label"] = value as string;
		}
		return props;
	case "clickable":
		return addClass(
			"pointer-events",
			value ? "auto" : "none",
			output,
			props
		);
	case "whitespace":
		return addClass(
			"white-space",
			value as string,
			output,
			props
		);
	case "align":		
		return addClass(
			"text-align",
			value as string,
			output,
			props
		);
	case "href": {
		const href = value as string;
		props.href = output.isAmp && href[0] === "/" ? `/amp${href}` : href;
		return props;
	}
	case "target":
		props.target = value as string;
		return props;
	case "links": {
		const map = value as Record<string, string>;
		Object.keys(map).forEach(key => {
			if(!(key === "amphtml" && output.isAmp)) {
				output.head.links[key] = map[key];
			}
		});
		return props;
	}
	case "metas": {
		const map = value as Record<string, string>;
		Object.keys(map).forEach(key => {
			output.head.metas[key] = map[key];
		});
		return props;
	}
	case "title":
		output.head.title = value as string;
		return props;
	case "direction":
		return addClass(
			"flex-direction",
			value as string,
			output,
			props
		);
	case "min": 
	case "max": {
		const size = value as {
			width ?: number
			height ?: number
		};
		if(size?.width) {
			addClass(
				`${name}-width`,
				numberToMeasurement(size.width),
				output,
				props
			);
		}
		if(size?.height) {
			addClass(
				`${name}-height`,
				numberToMeasurement(size.height),
				output,
				props
			);
		}
		return props;
	}
	case "columns":
		return addClass(
			"grid-template-columns",
			`repeat(${value}, 1fr)`,
			output,
			props
		);
	case "queries": {
		const queries = value as Component<Global, Local>["queries"];
		if(queries) {
			const from = output.css.query;
			keys(queries).forEach(query => {
				output.css.query = query as string;
				keys(queries[query]).forEach(prop => {

					handleProp({
						component,
						name: prop,
						output,
						props,
						value: queries[query][prop]
					});
				});
			});
			output.css.query = from;
		}
		return props;
	}
	case "weight":
		return addClass(
			"font-weight",
			`${value}`,
			output,
			props
		);
	case "rotate": {
		return addClass(
			"transform",
			`rotate(${value}deg)`,
			output,
			props
		);
	}
	case "translate": {
		const translate = value as Component<Global, Local>["translate"];
		if(translate) {
			return addClass(
				"transform",
				`translate(${numberToMeasurement(translate.x)}, ${numberToMeasurement(translate.y)})`,
				output,
				props
			);
		}
		return props;
	}
	case "index":
		return addClass(
			"z-index",
			`${value}`,
			output,
			props
		);
	case "editable":
		if(value) {
			props.contenteditable = `${value}`;
		}
		return props;
	case "rel":
		props.rel = `${value}`;
		return props;
	case "float":
		if(value === "clear") {
			return addClass(
				"clear",
				"both",
				output,
				props
			);
		} else {
			return addClass(
				"float",
				`${value}`,
				output,
				props
			);
		}
	case "analytics":
		output.analytics = `${value}`;
		return props;
	case "recaptcha":
		output.dependencies.add("recaptcha");
		output.recaptcha = `${value}`;
		return props;
	case "hover": {
		if(output.isAmp) return props;
		const {
			width,
			height,
			name,
			children,
			...extras
		} = value as Component<Global, Local>;
		output.css.psuedo = ":hover";
		keys(extras).forEach((name) => {
			handleProp({
				component,
				name,
				output,
				props,
				value: extras[name]
			});
		});
		output.css.psuedo = "";
		if(children?.length) {
			const query = output.css.queries["@media all"] = output.css.queries["@media all"] || {};
			const name = `[data-id=${component.id}]:hover > [data-id=${children[0].id}]`;
			const className = query[name] = query[name] || {};
			className["display"] = getDisplay(children[0]);
		}
		return props;
	}
	case "textCase":
		return addClass("text-transform", value as string, output, props);
	case "theme": {
		const theme = value as Theme;
		const all = output.css.queries["@media all"] = output.css.queries["@media all"] || {};
		// A
		const a = all["a"] = all["a"] || {};
		a["color"] = theme.link;
		// BODY
		const body = all["body"] = all["body"] || {};
		body["color"] = theme.text;
		body["background"] = theme.background;
		return props;
	}
	case "websocket":
		output.js.push(`var socket = (function() {
	var socket = new WebSocket("${value}");
	return {
		on : function(name, callback) {
			socket.addEventListener(name, callback);
		},
		send : function(name, data) {
			socket.send(JSON.stringify({
				name : name,
				data : data,
			}));
		}
	};
})();`);
		return props;
	case "drawer":
	case "draw":
	case "manifest":
	case "markdown":
	case "onWebSocketOpen":
	case "onWebSocketMessage":
	case "onWebSocketClose":
	case "onWebSocketError":
	case "onDragEnd":
	case "onResize":
	case "onDrop":
	case "onInit":
	case "onContext":
	case "onClick":
	case "onEnter":
	case "onInput":
	case "onBack":
	case "observe":
	case "onSelect":
	case "onChange":
	case "children":
	case "text":
	case "html":
	case "adapters":
	case "data":
	case "focus":
	case "resize":
	case "animation":
	case "funcs":
	case "bundle":
		return props;
	}
	failed(name);
	return props;
};

const handleChildren = <Global extends GlobalState, Local, Key extends keyof Component<Global, Local>>({
	component,
	name,
	value,
	output,
	global,
	local,
	index
} : {
    component : Component<Global, Local>
    name : Key
    value : Component<Global, Local>[Key]
    output : DocumentOutput
    global : Global
    local : Local
	index : number
}) => {
	switch(name) {
	case "layout":
		return;
	case "html": {
		const html = value as string;
		if(html) {
			if(output.isAmp) {
				const root = parseHTML(html);
				// HIGHLIGHT
				root.querySelectorAll("pre.ql-syntax").forEach(it => {
					const output = hljs.highlightAuto(it.innerText);
					it.classList.add("hljs");
					if(output.language) {
						it.classList.add(`language-${output.language}`);
					}
					it.innerHTML = output.value;
				});
				// IMAGES
				root.querySelectorAll("img").forEach(it => {
					it.replaceWith(`<amp-img src="${it.attributes.src}" height="240" layout="fixed-height"></amp-img>`);
				});
				output.html.push(root.outerHTML);
			} else {
				output.html.push(html);
			}
		}
		return;
	}
	case "text":
		output.html.push(escapeHtml(value as string || ""));
		return;
	case "children":
		(value as Component<Global, Local>[]).forEach(component => handle({
			component,
			local,
			global,
			output,
			index
		}));
		return;
	case "adapters": {
		const adapter = value as Component<Global, Local>["adapters"];
		const data = component.data;
		if(adapter) {
			for(const name in adapter) {
				const key = `${component.id}_${name}`;
				if(!output.cache.has(key)) {
					output.cache.add(key);
					const child = adapter[name]({
						global : global,
						local : null,
						parent : {
							height : 0,
							width : 0,
							name : "root",                                
						}
					}).children?.[0];
					if(child) {
						const adapterOutput = handle({
							index,
							component : child,
							global,
							local : null,
							output : {
								...output,
								html : []
							}
						});
						output.js.push(`adapters.${key} = $('${minifyHtml(adapterOutput.html.join("").replace(/\n/g, "\\n"), {
							collapseWhitespace: true,
						})}')`);
					}
				}
			}
			if(data) {
				data.forEach((local, index) => {
					if(!local) return;
					const parent : Component<Global, unknown> = {
						width : 0,
						height : 0,
						name : "root"
					};
					adapter[local.adapter || "local"]({
						global,
						local,
						parent
					});
					return handle({
						index,
						component : (parent.children || [])[0],
						global,
						local,
						output
					});
				});
			}
		}
		return;
	}
	case "onBack": {
		const id = `${name}:${component.id}`;
		if(!output.cache.has(id)) {
			output.cache.add(id);
			output.js.push("function onBack() {");
			(value as Array<(config : any) => ProgrammingLanguage>).forEach((callback) => {
				const generated = compile(callback, output.dependencies);
				output.js.push(javascript(generated, "\t"));
			});
			output.js.push("}");
			output.js.push(`history.pushState(null, document.title, location.href);
window.onpopstate = function() {
	var shouldQuit = global.routes.length === 1;
	if(!onBack() && shouldQuit) {
		history.back();
	} else {
		history.pushState(null, document.title, location.href);
	}
	update();
};`);
		}
		return;
	}
	case "onWebSocketOpen":
	case "onWebSocketMessage":
	case "onWebSocketClose":
	case "onWebSocketError": 
	case "onInit":
	case "onDragStart":
	case "onDragEnd":
	case "onDrop":
	case "observe":
	case "onInput":
	case "onEnter":
	case "onSelect":
	case "onChange":
	case "onResize":
	case "onContext":
	case "onClick": {
		output.dependencies.add(name);
		const id = `${name}:${component.id}`;
		if(!output.cache.has(id)) {
			output.cache.add(id);
			const generated = (value as Array<(config : any) => ProgrammingLanguage>).map((callback) => {
				const generated = compile(callback, output.dependencies);
				return generated ? javascript(generated, "\t") : "";
			}).filter(_ => _).join("\n");
			if(generated) {				
				output.js.push(`setEvent("${component.id}", "${name}", function(local, index, event) {
${generated}});`);
			}
		}
		return;
	}
	case "funcs":
		(value as Array<ProgrammingLanguage>).forEach((func) => {
			const generated = compile(() => func, output.dependencies);
			getDependencies(generated, output.dependencies);
			output.js.push(javascript(generated, "\t"));
		});
		return;
	case "markdown":
		output.html.push(converter.makeHtml(value as string));
		return;
	case "manifest":
		output.manifest = value as Manifest;
		return;
	case "hover": {
		if(output.isAmp) return;
		const { children } = (value as Component<Global, Local>);
		if(children?.length) {
			children.forEach(component => handle({
				component: {
					...component,
					visible : false
				},
				local,
				global,
				output,
				index
			}));
		}
		return;
	}
	case "drawer": {
		const component = value as Component<Global, Local>;
		if(output.isAmp) {
			const adapterOutput = handle({
				index,
				component : (component.children ?? [])[0] as any,
				global,
				local,
				output : {
					...output,
					html : []
				}
			});
			output.drawer = `<amp-sidebar id="drawer" layout="nodisplay" side="right">${minifyHtml(adapterOutput.html.join(""), {
				collapseWhitespace: true,
			})}</amp-sidebar>`;
		} else {
			const drawer = clientOnly<Global, Local>(fixed(MATCH, MATCH, [
				id("drawer"),
				clip(true),
				observe(({
					global,
					event,
				}) => block([
					set(event.clickable, global.isDrawerOpen),
					condition(
						eq(global.isDrawerOpen, true),
						set(event.opacity, 1),
					).otherwise(
						set(event.opacity, 0),
					),
				])),
				setIndex(indexes.drawer),
				position(0),
				background(theme => theme.overlay),
				column(240, MATCH, [
					({
						parent
					}) => {
						parent.children = component.children;
						return parent;
					},
					position({
						right : 0,
					}),
					background(theme => theme.background),
					padding(16),
					observe(({
						global,
						event,
					}) => condition(
						eq(global.isDrawerOpen, true),
						set(event.translate, {
							x : 0,
							y : 0,
						}),
					).otherwise(
						set(event.translate, {
							x : MATCH,
							y : 0,
						}),
					)),
				]),
			]))({
				global,
				local,
				parent : {
					height : 0,
					width : 0,
					name : "root",
				}
			});
			handle({
				index,
				component : (drawer.children || [])[0],
				global,
				local,
				output
			});
			return props;
		}
		return props;
	}
	case "websocket":
	case "theme":
	case "links":
	case "metas":
	case "title":
	case "src":
	case "bundle":
	case "opacity":
	case "visible":
	case "padding":
	case "margin":
	case "border":
	case "id":
	case "width":
	case "height":
	case "name":
	case "background":
	case "font":
	case "grow":
	case "data":
	case "position":
	case "value":
	case "placeholder":
	case "enabled":
	case "focus":
	case "resize":
	case "size":
	case "color":
	case "animation":
	case "mainAxisAlignment":
	case "crossAxisAlignment":
	case "round":
	case "clip":
	case "draw":
	case "shadow":
	case "alt":
	case "clickable":
	case "whitespace":
	case "align":
	case "target":
	case "href":
	case "queries":
	case "min":
	case "max":
	case "columns":
	case "direction":
	case "weight":	
	case "translate":
	case "rotate":
	case "index":
	case "editable":
	case "float":
	case "rel":
	case "analytics":
	case "recaptcha":
	case "textCase":
	case "ld":
	case "on":
		return;
	}
	failed(name);
};

const keys = <T extends Record<string, unknown>>(input : T) => Object.keys(input) as (keyof T)[];

const handle = <Global extends GlobalState, Local>({
	component,
	local,
	global,
	output,
	index,
} : {
    component : Component<Global, Local>
    local : Local
    global : Global
    output : DocumentOutput
	index : number
}) : DocumentOutput => {
	const {
		name,
		selfClosing
	} = getTagName(component.name, output);

	if(component.observe) {
		component.observe.forEach(callback => {
			const generated = compile(callback as (config : any) => ProgrammingLanguage, output.dependencies);
			execute(generated, {
				global,
				local,
				index,
				event : component,
				...stubs,
				moment,
				handlebars
			});
		});
	}

	const props = keys(component).reduce((props, name) => {
		return handleProp<Global, Local, typeof name>({
			component,
			name,
			props,
			value: component[name],
			output
		});
	}, <TagProps>{
		className: new Set<string>([])
	});
	
	const render = Object.keys(props).map(key => {
		const value = props[key] as unknown;
		if(key !== "children" && value) {
			if(value instanceof Set) {
				if(value.size) {
					return `class="${Array.from(value).join(" ")}"`;
				}
			} else {
				return `${key}="${escapeHtml(`${value}`)}"`;
			}
		}
	}).filter(_ => _).join(" ");

	if(selfClosing) {
		output.html.push(`<${name} ${render}/>`);
	} else {
		output.html.push(`<${name} ${render}>`);
	}
	keys(component).forEach((name) => {
		handleChildren({
			index,
			component,
			output,
			local,
			global,
			name,
			value : component[name]
		});
	});
	if(!selfClosing) {
		output.html.push(`</${name}>`);
	}

	return output;
};

const library = (dependencies : Set<string>) => [{
	dependency : "promise",
	code : `
var promise = function(callback) {
	return new Promise(function (onResolve, onReject) {
		return callback({
			onResolve : onResolve,
			onReject : onReject,
		})
	});
};`
}, {
	dependency : "recaptcha",
	code : `
var recaptcha = {
	execute : function(callback) {
		window.onRecaptcha = function(code) {
			callback({
				code : code
			});
			grecaptcha.reset();
		};
		grecaptcha.execute();
	}
};`
}, {
	dependency : "debounce",
	code : `
var debounce = (function() {
	var timeouts = {};
	return function(name, callback, ms) {
		clearTimeout(timeouts[name]);
		timeouts[name] = windowSetTimeout(function() {
			delete timeouts[name];
			callback();
			update();
		}, ms);
	};
})();`
}, {
	dependency : "throttle",
	code : `
var throttle = (function() {
	var timeouts = {};
	return function(name, callback, ms) {
		if(!timeouts[name]) {
			timeouts[name] = windowSetTimeout(function() {
				delete timeouts[name];
				callback();
				update();
			}, ms);
		}
	};
})();`
}, {
	dependency : "setTimeout",
	code: `
var setTimeout = (function() {
	return function(callback, ms) {
		return windowSetTimeout(function() {
			callback();
			update();
		}, ms);
	};
})();`
}, {
	dependency : "event.markdown",
	code : "var converter = new showdown.Converter();"
}, {
	dependency : "speech",
	code : "var speech = {};"
}, {
	dependency: "speech.speak",
	code: `
var utterance = new SpeechSynthesisUtterance();
speechSynthesis.getVoices(); // start loading
speech.speak = function(config) {
	function clean(input) {
		return input.toLowerCase().replace(/[^a-z]/g, "");
	}
	var voices = speechSynthesis.getVoices();
	var voice = voices.find(function(voice) {
		return clean(voice.lang) === clean(config.lang || "en-US");
	});
	if(voices.length && voice) {
		utterance.voice = voice;
		utterance.rate = config.rate || 1;
		utterance.text = config.text || "";
		speechSynthesis.cancel();
		speechSynthesis.speak(utterance);
	}
};`
}, {
	dependency : "device",
	code : `
var device = {};`
}, {
	dependency : "device.share",
	code : `
device.share = function(config) {
	if(navigator.canShare && navigator.share && navigator.canShare(config)) {
		navigator.share(config);
	} else {
		navigator.clipboard.writeText([config.title, config.text, config.url].filter(function(it) {
			return it;
		}).join("\\n"));
		window.Toaster && window.Toaster.pushToast({ message : "Copied link to clipboard." })
	}
};`
}, {
	dependency : "audio",
	code : `
var audio = {};`
}, {
	dependency : "audio.play",
	code : `
audio.play = (function() {
	var cache = {}, playing;
	return function(config) {
		playing && playing.pause();
		playing = cache[config.src];
		if(!playing) {
			playing = new Audio();
			playing.src = config.src;
		}
		cache[config.src] = playing;
		playing.currentTime = 0;
		playing.play();
	};	
})();
`
}, {
	dependency : "audio.record",
	code : `
(function() {
	var chunks = [];
	var mediaRecorder;
	audio.record = function(callback) {
		chunks.splice(0);
		if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
			navigator.mediaDevices.getUserMedia({
				audio : true,
			}).then(function (stream) {
				mediaRecorder = new MediaRecorder(stream);
				mediaRecorder.ondataavailable = function (e) {
					chunks.push(e.data);
				};
				mediaRecorder.onstop = function () {
					var blob = new Blob(chunks, { 
						type : "audio/webm", 
					});
					var url = window.URL.createObjectURL(blob);
					callback({
						url : url,
						blob : blob,
					});
				};
				mediaRecorder.start();
			});
		}
	};
	audio.stop = function() {
		mediaRecorder && mediaRecorder.stop();
		mediaRecorder = null;
	};
})();
`
}, {
	dependency : "speech.listen",
	code : `
var recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
speech.listen = function(config) {
	recognition.onresult = function(e) {
		config.onResult({
			results: Array.from(e.results).map(function(array) {
				return Array.from(array).map(function(alternative) {
					return {
						isFinal : array.isFinal,
						confidence: alternative.confidence,
						transcript: alternative.transcript
					}
				});
			}),
		});
		update();
	};
	recognition.continuous = config.continuous || false;
	recognition.lang = config.lang || "en-US";
	recognition.interimResults = config.interimResults || false;
	recognition.maxAlternatives = config.maxAlternatives || 1;
	recognition.start();
};`
}].filter(
	it => dependencies.has(it.dependency)
).map(
	it => it.code.trim()
).join("\n");

const document = (output : DocumentOutput) => {
	const {
		isAmp,
		ld,
		font,
		uuid,
		name,
		scripts,
		stylesheets,
		html,
		js,
		manifest,
		head: {
			title,
			metas,
			links
		},
		analytics,
		recaptcha,
		drawer
	} = output;
	return `<!doctype html>
    <html lang="en" ${isAmp ? "amp" : ""}>
    <head>
		<meta charset="utf-8">
		${isAmp ? "<script async src=\"https://cdn.ampproject.org/v0.js\"></script>" : ""}
		${isAmp && drawer ? "<script async custom-element=\"amp-sidebar\" src=\"https://cdn.ampproject.org/v0/amp-sidebar-0.1.js\"></script>" : ""}
		${isAmp ? "<style amp-boilerplate>body{-webkit-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-moz-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-ms-animation:-amp-start 8s steps(1,end) 0s 1 normal both;animation:-amp-start 8s steps(1,end) 0s 1 normal both}@-webkit-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-moz-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-ms-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-o-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}</style><noscript><style amp-boilerplate>body{-webkit-animation:none;-moz-animation:none;-ms-animation:none;animation:none}</style></noscript>" : ""}
		${`
			<title>${manifest?.name ?? title}</title>
			${ld ? `<script type="application/ld+json">${JSON.stringify(ld)}</script>` : ""}
			${manifest ? `
			<meta name="description" content="${manifest.description}" />
			<meta name="theme-color" content="${manifest.theme_color}" />
			<link rel="manifest" href="./${name}-manifest.json" />
				` : ""}${
	Object.keys(metas).filter(key => metas[key]).map(key => `<meta name="${key}" content="${metas[key]}" />`).join("")
}${
	Object.keys(links).filter(key => links[key]).map(key => `<link rel="${key}" href="${links[key]}" />`).join("")
}`}
		${isAmp ? "" : stylesheets.map(href => `<link href="${href}" rel="stylesheet"/>`).join("")}
		<link href="https://fonts.googleapis.com/css2?family=${font || "Roboto"}:ital,wght@0,400;0,500;0,700;1,400;1,500;1,700&display=swap" rel="stylesheet"/>
		${isAmp ? `
			<style amp-custom>
				${output.dependencies.has("quill") ? minifyCss(hljsCSS, true) : ""}
				${sharedCss(output)}
				${localCss(output)}
			</style>
		` : `
			<link href="/shared.css?q=${VERSION}" rel="stylesheet" />
			<link href="/${name}.css?q=${uuid}" rel="stylesheet" />
		`}
		<meta name="viewport" content="width=device-width, initial-scale=1" />
	</head>
	<body>
		${recaptcha ? `<div class="g-recaptcha" data-sitekey="${recaptcha}" data-callback="onRecaptcha" data-size="invisible"></div>` : ""}
		${html.join("")}
		${isAmp ? "" : [...(recaptcha ? [
		"https://www.google.com/recaptcha/api.js"
	] : []), ...(analytics ? [
		`https://www.googletagmanager.com/gtag/js?id=${analytics}`
	] : []), ...scripts].map(src => `<script defer src="${src}"></script>`).join("")}
		${!isAmp && js.length ? `<script defer src="/shared.js?q=${VERSION}"></script><script defer src="/${name}.js?q=${uuid}"></script>` : ""}
		${drawer}
	</body>
</html>`;
};