import { 
	code, 
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
	props
} from "polygraphic";
import { DocumentOutput } from "./types";
export * from "./types";
import moment from "moment";
import showdown from "showdown";

const converter = new showdown.Converter();

const speech = {
	listen : () => {
		// DO NOTHING
	},
	speak : () => {
		// DO NOTHING
	}
};

export const html = <Global extends GlobalState, Local>(
	root : ComponentFromConfig<Global, Local>
) => (
		state : Global & Local
	) => document(json(root)(state));

export const json = <Global extends GlobalState, Local>(
	root : ComponentFromConfig<Global, Local>
) => (
		state : Global & Local
	) : DocumentOutput => { 
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
			js : [
				"var converter = new showdown.Converter();",
				"var adapters = {};",
				"var events = {};",
				"var listeners = [];",
				`var global = ${JSON.stringify(state, null, "\t")};`,
			],
			css : [],
			html : [],
			scripts : [
				"https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js",
				"https://cdnjs.cloudflare.com/ajax/libs/showdown/2.0.3/showdown.min.js"
			],
			cache : new Set()
		};
		handle({
			component,
			global: state,
			local : state,
			output
		});
		output.js.push("bind(document.body, Local(global, 0));");
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
		props.style.color = value as string;
		return props;
	case "size":
		props.style["font-size"] = `${value}px`;
		return props;
	case "src":
		props.src = value as string;
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
	case "markdown":
	case "onDragEnd":
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
								cache : output.cache,
								css : output.css,
								html : [],
								scripts : [],
								js : output.js
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
				const generated = code(callback, new Set([]), {
					global,
					local,
					moment,
					speech
				});
				output.js.push(javascript(generated, "\t"));
			});
			output.js.push("}");
			output.js.push(`history.pushState(null, document.title, location.href);
window.onpopstate = function() {
	if(onBack()) {
		if(global.routes.length === 1) {
			history.back();
		} else {
			global.routes[global.routes.length - 1].animation = {
				direction : "out",
				name : "right",
				start : Date.now()
			};
			setTimeout(function() {
				global.routes = global.routes.slice(0, -1);
			}, 300);
			history.pushState(null, document.title, location.href);
		}
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
	case "onClick": {
		const id = `${name}:${component.id}`;
		if(!output.cache.has(id)) {
			output.cache.add(id);
			output.js.push(`setEvent("${component.id}", "${name}", function(local, index, event) {`);
			(value as Array<(config : any) => ProgrammingLanguage>).forEach((callback) => {
				const generated = code(callback, new Set([]), {
					global,
					local,
					moment,
					speech
				});
				output.js.push(javascript(generated, "\t"));
			});
			output.js.push("});");
		}
		return;
	}
	case "funcs":
		(value as Array<ProgrammingLanguage>).forEach((func) => {
			const generated = code(() => func, new Set([]), {
				global,
				local,
				moment,
				speech
			});
			output.js.push(javascript(generated, "\t"));
		});
		return;
	case "markdown":
		output.html.push(converter.makeHtml(value?.toString() ?? ""));
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
	case "src":
	case "size":
	case "color":
	case "animation":
	case "mainAxisAlignment":
	case "crossAxisAlignment":
	case "round":
	case "clip":
	case "shadow":
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
			const generated = code(callback, new Set([]));
			execute(generated, {
				global,
				local,
				event : component,
				moment,
				speech
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

const document = ({
	scripts,
	html,
	js
} : DocumentOutput) => `<!doctype html>
    <html>
    <head>
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<style>
@import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,400;0,500;0,700;1,400;1,500;1,700&display=swap');
html, body {
	display : flex;
	width : 100%;
	min-height : 100%;
	font-size : 16px;
}
* { 
	box-sizing: border-box;
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
		</style>
		${scripts.map(src => `<script src="${src}"></script>`).join("")}
    </head>
    <body>
        ${html.join("")}
        <script>
${javascriptBundle()}
var isMobile = /mobi/i.test(window.navigator.userAgent);
/*
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
})();
*/
var recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
var speech = {
	listen : function(config) {
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
	}
};
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
                switch(key) {
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
        });
    }
})();
function bind(root, local) {
    root.__local__ = local;
    Array.from(root.querySelectorAll("[data-id]")).concat(root.dataset.id ? [root] : []).forEach(function(component) {
        var toBind = events[component.dataset.id];
        Object.keys(toBind).forEach(function(event) {
            var callback = toBind[event];
            if(event === "onDrop") {
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
        </script>
        <script>
${js.join("\n")}
        </script>
    </body>
</html>`;