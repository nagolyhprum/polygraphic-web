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
	EventConfig
} from "polygraphic";
import { DocumentOutput, Manifest, TagProps } from "./types";
export * from "./types";
import moment from "moment";
import showdown from "showdown";
import { minify as minifyHtml } from "html-minifier";
import CleanCss from "clean-css";
import UglifyJS from "uglify-js";


const minifyCss = (css : string, minify : boolean) : string => {
	return minify ? new CleanCss().minify(css).styles : css;
};

const minifyJs = (js : string, minify : boolean) : string => {
	return minify ? UglifyJS.minify(`(function(window){${js}})(window);`).code : js;
};

const converter = new showdown.Converter();

export const html = <Global extends GlobalState, Local>(
	root : ComponentFromConfig<Global, Local>,
	name : string,
	minify = false
) => (
		generateState : (config : (event : EventConfig<GlobalState, null, null>) => Global & Local) => Global & Local
	) : Record<string, string | Buffer> => {
		const result = json(root, name)(generateState);
		const files : Record<string, string | Buffer> = {			
			[`${name}.html`] : minify ? minifyHtml(document(result), {
				collapseWhitespace: true,
				collapseInlineTagWhitespace: true
			}) : document(result),
			[`${name}.css`] : minifyCss(`${Object.keys(result.css.queries).map(query => {
				return `${query}{\n\t${
					Object.keys(result.css.queries?.[query] || {}).map(className => {
						return `.${className}{${
							Object.keys(result.css.queries?.[query]?.[className] || {}).map(styleName => {
								return `${styleName}:${result.css.queries?.[query]?.[className]?.[styleName]}`;
							}).join(";")}}`;
					}).join("\n\t")}}`;
			}).join("\n")}
@import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,400;0,500;0,700;1,400;1,500;1,700&display=swap');
html, body {
	display : flex;
	width : 100%;
	min-height : 100%;
	font-size : 16px;
}
* { 
	box-sizing: border-box;
	transition: opacity 300ms, width 300ms, height 300ms, transform 300ms;
}
button {
	cursor : pointer;
}
select, input, button, html, body, nav, footer, header, main, section, h1, h2, h3, p, span, a {
	display : inline-flex;
	font-family: 'Roboto', sans-serif;
	text-align : start;
	background : transparent;
	margin : 0;
	padding : 0;
	border : 0;
	font-size : 16px;
	text-decoration : none;
}
.progress {
	display: inline-block;
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
}
h1, h2, h3, p, span, a {
	display : inline-block;
}`, minify),
			...(result.js.length ? {
				[`${name}.js`] : minifyJs(result.js.join("\n"), minify),
			} : {})
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
	dependency : "moment",
	src : "https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js",
}, {
	dependency : "event.markdown",
	src : "https://cdnjs.cloudflare.com/ajax/libs/showdown/2.0.3/showdown.min.js"
}, {
	dependency : "socket",
	src : "https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.4.1/socket.io.min.js"
}];

const json = <Global extends GlobalState, Local>(
	root : ComponentFromConfig<Global, Local>,
	name : string
) => (
		
		generateState : (config : (event : EventConfig<GlobalState, null, null>) => Global & Local) => Global & Local
	) : DocumentOutput => { 
		const dependencies = new Set<string>([]);
		const generated = compile(generateState as unknown as (config : any) => ProgrammingLanguage, dependencies);
		const state = execute(generated, {
			...stubs,
			moment
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
			name,
			dependencies : new Set<string>([]),
			js : [],
			head : {
				title : "",
				links: {},
				metas: {}
			},
			css : {
				cache : {},
				letter : "a",
				queries : {},
				query : "@media all"
			},
			html : [],
			scripts : [],
			cache : new Set<string>([]),
		};
		handle({
			component,
			global: state,
			local : state,
			output
		});
		if(output.js.length) {
			output.js.unshift(`${javascriptBundle(output.dependencies)}
${library(output.dependencies)}
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
var adapters = {};
var events = {};
var listeners = [];
var isMobile = /mobi/i.test(window.navigator.userAgent);
function Local(value, index) {
	return {
		value : value,
		index : index
	};
}
function $(html) {
	var div = document.createElement("div");
	div.innerHTML = html;
	var child = div.children[0];
	return function() {
		return child.cloneNode(true);
	};
}
function setEvent(id, name, callback) {
	events[id] = events[id] || {};
	events[id][name] = callback;
}

function numberToMeasurement(input) {
	if(input === null || input === undefined) {
		return "";
	}
	if(0 < input && input < 1) {
		return (input * 100) + "%";
	} else if(input === ${WRAP}) {
		return "auto";
	} else if(input === ${MATCH}) {
		return "100%";
	} else {
		return input + "px";
	}
}
var protect = (function() {
	var last = 0;
	return function(callback) {
		var now = Date.now();
		if(now - last >= 300) {
			last = now;
			callback();
		}
	};
})();
function Component(component) {
	var cache = {};
	return new Proxy(component, {
		get : function(target, key) {
			if(key === "isMounted") {
				return document.body.contains(component);
			}
		},
		set : function(target, key, value) {
			if(!(key in cache) || cache[key] !== value) {
				cache[key] = value;
				${ /* TODO : LOOK AT DEPENDENCIES */ "" }
				switch(key) {
					case "translate":
						target.style.transform = "translate(" + numberToMeasurement(value.x) + "," + numberToMeasurement(value.y) + ")";
						return;
					case "src":
						target.src = value;
						return;
					case "clickable":
						target.style.pointerEvents = value ? "auto" : "none";
						return;
					case "width":
					case "height":
						target.style[key] = numberToMeasurement(value);
						return;
					case "focus":
						windowSetTimeout(function() {
							target.focus();
							target.setSelectionRange(0, target.value.length);
						}, 300);
						return;
					case "opacity":
						target.style.opacity = value;
						return;
					case "enabled":
						target.disabled = !value;
						return;
					case "placeholder":
						target.placeholder = value;
						return;
					case "animation":
						if(!value) return;
						target.style.willChange = "opacity, transform";
						function render() {
							const progress = Math.max(Math.min((Date.now() - value.start) / 300, 1), 0)
							if(progress < 1) {
								requestAnimationFrame(render);
							} else {
								windowSetTimeout(function() {
									target.style.willChange = "auto";
								})
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
						return;
					case "text":
						target.innerText = value;
						return;
					case "data":
						if(!cache.prevData) {
							target.innerHTML = "";
						}
						var prev = cache.prevData || [];
						if(!value) {
							return;
						}
						var curr = value.map(function(it) {
							return "id" in it ? it.id : it.key;
						});
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
						cache.prevData = curr;
						target.value = cache.value;
						return;
					case "position":
						target.style.top = typeof value.top === "number" ? value.top + "px" : "auto";
						target.style.right = typeof value.right === "number" ? value.right + "px" : "auto";
						target.style.bottom = typeof value.bottom === "number" ? value.bottom + "px" : "auto";
						target.style.left = typeof value.left === "number" ? value.left + "px" : "auto";
						return;
					case "background":
						target.style.background = value;
						return;
					case "visible":
						target.style.display = value ? (target.style.flexDirection ? "flex" : "block") : "none";
						return;
					case "markdown":
						target.innerHTML = converter.makeHtml(value);
						return;
				}
			}
		}
	});
}
var windowSetTimeout = window.setTimeout;
var setTimeout = (function() {
	return function(callback, ms) {
		return windowSetTimeout(function() {
			callback();
			update();
		}, ms);
	};
})();
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
			${output.manifest ? `localStorage.${name} = JSON.stringify(global);` : ""}
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
			if(event === "onResize") {
				const observer = new ResizeObserver(function(entries) {
					const rect = component.getBoundingClientRect();
					callback(local.value, local.index, {
						width: rect.width,
						height: rect.height,
					});
					update();
				});
				observer.observe(component);
			} else if(event === "onDrop") {
				function prevent(e) {
					e.preventDefault();
					e.stopPropagation();
					e.cancelBubble = true;
					return false;
				};
				component.ondragenter = prevent
				component.ondragleave = prevent
				component.ondragover = prevent
				component.ondrop = function() {
					callback(local.value, local.index);
					update();
				};
			} else if(event === "onDragStart") {
				component.ondragstart = function() {
					callback(local.value, local.index);
					update();
				};
			} else if(event === "onDragEnd") {
				component.ondragend = function() {
					callback(local.value, local.index);
					update();
				};
			} else if(event === "onChange") {
				if(component.tagName.toLowerCase() === "select") {
					component.onchange = function() {					
						const value = this.value;
						protect(function() {
							callback(local.value, local.index, value);
							update();
						});
					};
				} else if(component.type === "checkbox") {
					component.onclick = function() {					
						const checked = this.checked;
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
						callback(local.value, local.index, this.value);
						update();
					};
				}
			} else if(event === "onClick") {
				component.onclick = function() {
					protect(function() {
						callback(local.value, local.index/*,event*/);
						update();
					})
				};
			} else if(event === "onEnter") {
				component.onkeypress = function(e) {					
					if(e.which === 13) {
						protect(function() {
							callback(local.value, local.index);
							update();
						});
					}
				};
			} else if(event === "observe") {
				var wrapped = Component(component);
				listeners.push({
					component : wrapped,
					callback : callback,
					local : local,
					id : component.dataset.id
				});
				callback(local.value, local.index, wrapped)
			} else if(event === "onInit") {
				callback(local.value, local.index);
				update();
			}
		});
	});
}
var speech = (function() {
	var utterance = new SpeechSynthesisUtterance();
	var recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
	return {
		speak: function(config) {
			utterance.lang = config.lang || "en-US";
			utterance.rate = config.rate || 1;
			utterance.text = config.text || "";
			speechSynthesis.cancel();
			speechSynthesis.speak(utterance);
		},
		listen: function(config) {
			recognition.onresult = function(e) {
				config.onResult({
					results: Array.from(e.results).map(function(array) {
						return Array.from(array).map(function(alternative) {
							return {
								confidence: alternative.confidence,
								transcript: alternative.transcript
							}
						});
					})
				});
				update();
			};
			recognition.continuous = config.continuous || false;
			recognition.lang = config.lang || "en-US";
			recognition.interimResults = config.interimResults || false;
			recognition.maxAlternatives = config.maxAlternatives || 1;
			recognition.start();
		}
	};
}());`);
			output.js.push("bind(document.body, Local(global, 0));");
		}
		scripts.forEach(script => {
			if(output.dependencies.has(script.dependency)) {
				output.scripts.push(script.src);
			}
		});
		return output;
	};

function failed(_ : never) {
	throw new Error("this should never happen");
}

const getTagName = (name : Tag) : {
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
	case "grid":
	case "flex":
	case "progress":
	case "stack":
	case "scrollable":
	case "row":
	case "root":
	case "column":
		return {
			name : "div",
			selfClosing : false
		};
	case "date":
	case "checkbox":
	case "input":
		return {
			name : "input",
			selfClosing : true
		};
	case "image":
		return {
			name : "img",
			selfClosing : true
		};
	}
};


const numberToMeasurement = (input : number | null | undefined) : string => {
	if(input === null || input === undefined) {
		return "";
	}
	if(0 < input && input < 1) {
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
	const cache = output.css.cache[output.css.query]?.[name]?.[value];
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
			const query = output.css.cache[output.css.query] = output.css.cache[output.css.query] || {};
			const style = query[name] = query[name] || {};
			style[value] = letter;
		}
		{ // set up the output
			const query = output.css.queries[output.css.query] = output.css.queries[output.css.query] || {};
			const className = query[letter] = query[letter] || {};
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
	case "width":
	case "height":
		if(typeof value === "number") {
			addClass(
				name,
				numberToMeasurement(value),
				output,
				props
			);
		}
		return props;
	case "name":
		if(value === "fixed") {
			addClass(
				"position",
				"fixed",
				output,
				props
			);
		}
		if(value === "progress") {
			props.class = "progress";
		}
		if(value === "stack") {
			addClass(
				"position",
				"relative",
				output,
				props
			);
		} else if([
			"row", 
			"column", 
			"flex"
		].includes(value as string)) {
			addClass(
				"display",
				"flex",
				output,
				props
			);
			if(["row", "column"].includes(value as string)) {
				addClass(
					"flex-direction",
					value as string,
					output,
					props
				);
			}
		}
		if(value === "grid") {
			addClass(
				"display",
				"grid",
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
		if(value === "checkbox") {
			props.type = "checkbox";
		}
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
		if(value) {
			props["data-id"] = value as string;
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
		if(!value) {
			addClass(
				"display",
				"none",
				output,
				props
			);
		}
		return props;
	case "value":
		props.value = value as string;
		return props;
	case "placeholder":
		props.placeholder = value as string;
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
				"rgba(0, 0, 0, 0.15) 1.95px 1.95px 2.6px",
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
		if(value === false) {
			addClass(
				"pointer-events",
				"none",
				output,
				props
			);
		}
		return props;
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
	case "href":
		props.href = value as string;
		return props;
	case "target":
		props.target = value as string;
		return props;
	case "links": {
		const map = value as Record<string, string>;
		Object.keys(map).forEach(key => {
			output.head.links[key] = map[key];
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
	case "max": {
		const max = value as Component<Global, Local>["max"];
		if(max?.width) {
			addClass(
				"max-width",
				numberToMeasurement(max.width),
				output,
				props
			);
		}
		if(max?.height) {
			addClass(
				"max-height",
				numberToMeasurement(max.height),
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
	case "manifest":
	case "markdown":
	case "onDragEnd":
	case "onResize":
	case "onDrop":
	case "onInit":
	case "onClick":
	case "onEnter":
	case "onInput":
	case "onBack":
	case "observe":
	case "onSelect":
	case "onChange":
	case "children":
	case "text":
	case "adapters":
	case "data":
	case "focus":
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
	local
} : {
    component : Component<Global, Local>
    name : Key
    value : Component<Global, Local>[Key]
    output : DocumentOutput
    global : Global
    local : Local
}) => {
	switch(name) {
	case "text":
		output.html.push(value as string);
		return;
	case "children":
		(value as Component<Global, Local>[]).forEach(component => handle({
			component,
			local,
			global,
			output
		}));
		return;
	case "adapters": {
		const adapter = value as Component<Global, Local>["adapters"];
		const data = component.data;
		if(adapter) {
			for(const index in adapter) {
				const key = `${component.id}_${index}`;
				if(!output.cache.has(key)) {
					output.cache.add(key);
					const child = adapter[index]({
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
							component : child,
							global,
							local : null,
							output : {
								...output,
								html : []
							}
						});
						output.js.push(`adapters.${key} = $('${adapterOutput.html.join("")}')`);
					}
				}
			}
			if(data) {
				data.forEach(local => {
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
	const shouldQuit = global.routes.length === 1;
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
	case "onClick": {
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
		return props;
	case "manifest":
		output.manifest = value as Manifest;
		return props;
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
	case "grow":
	case "data":
	case "position":
	case "value":
	case "placeholder":
	case "enabled":
	case "focus":
	case "size":
	case "color":
	case "animation":
	case "mainAxisAlignment":
	case "crossAxisAlignment":
	case "round":
	case "clip":
	case "shadow":
	case "alt":
	case "clickable":
	case "whitespace":
	case "align":
	case "target":
	case "href":
	case "queries":
	case "max":
	case "columns":
	case "direction":
	case "weight":	
	case "translate":
	case "index":
		return;
	}
	failed(name);
};

const keys = <T>(input : T) => Object.keys(input) as (keyof T)[];

const handle = <Global extends GlobalState, Local>({
	component,
	local,
	global,
	output
} : {
    component : Component<Global, Local>
    local : Local
    global : Global
    output : DocumentOutput
}) : DocumentOutput => {
	const {
		name,
		selfClosing
	} = getTagName(component.name);

	if(component.observe && local) {
		component.observe.forEach(callback => {
			const generated = compile(callback as (config : any) => ProgrammingLanguage, output.dependencies);
			execute(generated, {
				global,
				local,
				event : component,
				...stubs,
				moment
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
				return `${key}="${value}"`;
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
	dependency : "event.markdown",
	code : "var converter = new showdown.Converter();"
}, {
	dependency : "socket",
	code : `
var socket = (function () {
	var socket = io();
	return {
		on : function(name, callback) {
			socket.on(name, function(data) {
				callback({ data })
				update();
			})
		}
	};
})();`
}, {
	dependency : "speech",
	code : "var speech = {};"
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

const document = ({
	name,
	scripts,
	html,
	js,
	manifest,
	head: {
		title,
		metas,
		links
	}
} : DocumentOutput) => `<!doctype html>
    <html lang="en">
    <head>
		${manifest ? `
			<title>${manifest.name}</title>
			<meta name="description" content="${manifest.description}" />
			<meta name="theme-color" content="${manifest.theme_color}" />
			<link rel="manifest" href="./${name}-manifest.json" />
		` : `<title>${title}</title>${
		Object.keys(metas).map(key => `<meta name="${key}" content="${metas[key]}" />`).join("")
	}${
		Object.keys(links).map(key => `<link rel="${key}" href="${links[key]}" />`).join("")
	}`}
		<link href="./${name}.css" rel="stylesheet" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
	</head>
	<body>
		${html.join("")}
		${scripts.map(src => `<script defer src="${src}"></script>`).join("")}
		${js.length ? `<script defer src="./${name}.js"></script>` : ""}
	</body>
</html>`;