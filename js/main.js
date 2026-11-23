// 시뮬레이터 진입점: 모듈을 연결하고 초기화한다.
import { init, hooks } from "./sim.js";
import { initTimeline, renderTimeline } from "./timeline.js";

initTimeline();
hooks.onRender.push(renderTimeline);
init();
