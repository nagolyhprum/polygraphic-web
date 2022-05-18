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
	TagProps,
	ProgrammingLanguage,
	javascriptBundle,
	Alignment,
	props,
	getDependencies,
	compile,
	stubs,
	EventConfig
} from "polygraphic";
import { DocumentOutput, Manifest } from "./types";
export * from "./types";
import moment from "moment";
import showdown from "showdown";
import path from "path";
import fs from "fs";
import { createCanvas, loadImage } from "canvas";

const getPath = (input : string) => {
	return input.replace(/^file:\/\//, "");
};

const readFile = (path : string) => {
	return new Promise<string>((resolve, reject) => {
		fs.readFile(path, "utf-8", (err: Error | null, data: string) => {
			if(err) reject(err);
			else resolve(data);
		});
	});
};

const MANIFEST_ICON_SIZES = [48, 72, 96, 128, 192, 256, 512];

const createImage = async ({
	icon,
	background,
	size,
	percent
} : {
	icon : string
	background : string
	size : number
	percent : number
}) : Promise<Buffer> => {
	const image = await loadImage(icon);
	const canvas = createCanvas(size, size);
	const context = canvas.getContext("2d");
	context.fillStyle = background;
	context.fillRect(0, 0, size, size);
	const resize = size / Math.min(image.width, image.height) * percent;
	const width = image.width * resize;
	const height = image.height * resize;
	const x = size / 2 - width / 2;
	const y = size / 2 - height / 2;
	image.width = width;
	image.height = height;
	context.drawImage(image, x, y, width, height);
	return canvas.toBuffer("image/png");
};

const converter = new showdown.Converter();

export const html = <Global extends GlobalState, Local>(
	root : ComponentFromConfig<Global, Local>,
	name : string
) => async (
		generateState : (config : (event : EventConfig<GlobalState, null, null>) => Global & Local) => Global & Local
	) : Promise<Record<string, string | Buffer>> => {
		const result = json(root, name)(generateState);
		const files : Record<string, string | Buffer> = {			
			[`${name}.html`] : document(result),
			[`${name}.css`] : `@import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,400;0,500;0,700;1,400;1,500;1,700&display=swap');
html, body {
	display : flex;
	width : 100%;
	min-height : 100%;
	font-size : 16px;
}
* { 
	box-sizing: border-box;
	transition: opacity 300ms, width 300ms, height 300ms;
}
button {
	cursor : pointer;
}
select, input, button, html, body, p, span {
	display : inline-flex;
	font-family: 'Roboto', sans-serif;
	text-align : start;
	background : transparent;
	margin : 0;
	padding : 0;
	border : 0;
	font-size : 16px;
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
p, span {
	display : inline-block;
}`,
			[`${name}.js`] : result.js.join("\n"),
			...(await result.images.reduce(async (promise, image) => {
				const images = await promise;
				return {
					...images,
					[path.basename(image)] : await readFile(getPath(image))
				};
			}, {}))
		};
		if(result.manifest) {
			const manifest = result.manifest;
			const icon = manifest.icons;
			const src = getPath(icon.src);
			files[`${name}-mask.png`] = await createImage({
				background : manifest.background_color,
				icon : src,
				percent : icon.percent,
				size : 192
			});
			files[`${name}-favicon.png`] = await createImage({
				background : manifest.background_color,
				icon : src,
				percent : 1,
				size : 16
			});
			files[`${name}-ati.png`] = await createImage({
				background : manifest.background_color,
				icon : src,
				percent : icon.percent,
				size : 180
			});
			await Promise.all(MANIFEST_ICON_SIZES.map(async size => {
				files[`${name}-${size}x${size}.png`] = await createImage({
					background : manifest.background_color,
					icon : src,
					percent : icon.percent,
					size
				});
			}));
			files[`${name}-manifest.json`] = JSON.stringify({
				...manifest,
				icons : [{
					src : `${name}-mask.png`,
					purpose : "maskable",
					sizes : "192x192"
				}, ...MANIFEST_ICON_SIZES.map(size => ({
					sizes : `${size}x${size}`,
					src : `${name}-${size}x${size}.png`
				}))]
			}, null, "\t");
			files[`${name}-service-worker.js`] = `
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
});`;
	
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
			css : [],
			html : [],
			scripts : [],
			cache : new Set<string>([]),
			images : []
		};
		handle({
			component,
			global: state,
			local : state,
			output
		});
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
					case "src":
						target.src = value + ".svg"
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
}`);
		output.js.push("bind(document.body, Local(global, 0));");
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
	
const handleBox = (prefix : string, input : BoxProp<Array<unknown> | number>, props : TagProps) => {
	keys(input).forEach(key => {
		const value = input[key];
		if(value instanceof Array) {
			props.style[`${prefix}${key}`] = value.map(it => typeof it === "number" ? numberToMeasurement(it) : it).join(" ");
		} else {
			props.style[`${prefix}${key}`] = numberToMeasurement(value);
		}
	});
};

const handleProp = <Global extends GlobalState, Local, Key extends keyof Component<Global, Local>>({
	component,
	name,
	value,
	props,
} : {
    component : Component<Global, Local>
    name : Key
    value : Component<Global, Local>[Key]
    props : TagProps
}) : TagProps => {
	switch(name) {
	case "width":
	case "height":
		if(typeof value === "number") {
			props.style[name] = numberToMeasurement(value);
		}
		return props;
	case "name":
		if(value === "progress") {
			props.class = "progress";
		}
		if(value === "stack") {
			props.style.position = "relative";
		} else if(value === "row" || value === "column") {
			props.style.display = "flex";
			props.style["flex-direction"] = value.toString();
		}
		if(value === "date") {
			props.type = "date";
		}
		if(value === "scrollable") {
			props.style.overflow = "auto";
		}
		if(value === "checkbox") {
			props.type="checkbox";
		}
		return props;
	case "background":
		props.style.background = value?.toString() ?? "";
		return props;
	case "grow":
		props.style["flex-grow"] = value ? "1" : "";
		return props;
	case "id":
		props["data-id"] = value?.toString() ?? "";
		return props;
	case "position":
		props.style.position = "absolute";
		handleBox("", value as BoxProp<number | Array<unknown>>, props);
		return props;
	case "padding":
	case "margin":
	case "border":
		handleBox(`${name}-`, value as BoxProp<number | Array<unknown>>, props);
		return props;
	case "visible":
		if(!value) {
			props.style.display = "none";
		}
		return props;
	case "value":
		props.value = value?.toString() ?? "";
		return props;
	case "placeholder":
		props.placeholder = value?.toString() ?? "";
		return props;
	case "enabled":
		props.disabled = value === false ? "disabled" : "";
		return props;
	case "onDragStart":
		props.draggable = "true";
		return props;
	case "color":
		if(component.name === "progress") {
			props.style["border-top-color"] = value as string;
		} else {
			props.style.color = value as string;
		}
		return props;
	case "size":
		props.style["font-size"] = `${value}px`;
		return props;
	case "src":
		props.src = path.basename(value as string);
		return props;
	case "crossAxisAlignment":
		if(component.name === "row") {
			props.style["align-items"] = value as Alignment;
		} else if(component.name === "column") {
			props.style["align-items"] = value as Alignment;
		}
		return props;
	case "mainAxisAlignment":
		if(component.name === "row") {
			props.style["justify-content"] = value as Alignment;
		} else if(component.name === "column") {
			props.style["justify-content"] = value as Alignment;
		}
		return props;
	case "round":
		props.style["border-radius"] = numberToMeasurement(value as number);
		return props;
	case "clip":
		if(value) {
			props.style.overflow = "hidden";
		}
		return props;
	case "shadow":
		if(value) {
			props.style["z-index"] = "1";
			props.style["box-shadow"] = "rgba(0, 0, 0, 0.15) 1.95px 1.95px 2.6px";
		}
		return props;
	case "opacity":
		props.style.opacity = `${value}`;
		return props;
	case "alt":
		props.alt = `${value}`;
		return props;
	case "clickable":
		if(value === false) {
			props.style["pointer-events"] = "none";
		}
		return props;
	case "whitespace":
		props.style["white-space"] = value as string;
		return props;
	case "align":
		props.style["text-align"] = value as string;
		return props;
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
	case "bundle":
		output.images.push(...(value as string[]));
		return;
	case "text":
		output.html.push(value?.toString() ?? "");
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
			output.js.push(`setEvent("${component.id}", "${name}", function(local, index, event) {`);
			(value as Array<(config : any) => ProgrammingLanguage>).forEach((callback) => {
				const generated = compile(callback, output.dependencies);
				output.js.push(javascript(generated, "\t"));
			});
			output.js.push("});");
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
		output.html.push(converter.makeHtml(value?.toString() ?? ""));
		return props;
	case "manifest":
		output.manifest = value as Manifest;
		return props;
	case "src":
		output.images.push(value as string);
		return props;
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
			value: component[name]
		});
	}, {
		style : {}
	} as TagProps);

	const render = Object.keys(props).map(key => {
		const value = props[key];
		if(key !== "children" && value) {
			if(typeof value === "object") {
				return `style="${keys(value).map((key) => {
					return `${key.toString()}:${value[key]}`;
				}).join(";")}"`;
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
	manifest
} : DocumentOutput) => `<!doctype html>
    <html lang="en">
    <head>
		${manifest ? `
			<title>${manifest.name}</title>
			<meta name="description" content="${manifest.description}" />
			<meta name="theme-color" content="${manifest.theme_color}" />
			<link rel="icon" href="${name}-favicon.png" />
			<link rel="apple-touch-icon" href="${name}-ati.png" />
			<link rel="manifest" href="./${name}-manifest.json" />
		` : ""}
		<link href="./${name}.css" rel="stylesheet" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
	</head>
	<body>
		${html.join("")}
		${scripts.map(src => `<script src="${src}"></script>`).join("")}
		${js.length ? `<script src="./${name}.js"></script>` : ""}
	</body>
</html>`;