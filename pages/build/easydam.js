/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./pages/easydam/Analytics.js":
/*!************************************!*\
  !*** ./pages/easydam/Analytics.js ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/element */ \"@wordpress/element\");\n/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_0__);\n\nconst Analytics = () => {\n  return (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", null, \"Analytics\");\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Analytics);\n\n//# sourceURL=webpack://EasyDAM/./pages/easydam/Analytics.js?");

/***/ }),

/***/ "./pages/easydam/EasyDAM.js":
/*!**********************************!*\
  !*** ./pages/easydam/EasyDAM.js ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/element */ \"@wordpress/element\");\n/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_0__);\n\nconst EasyDAM = () => {\n  return (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", null, \"EasyDAM\");\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EasyDAM);\n\n//# sourceURL=webpack://EasyDAM/./pages/easydam/EasyDAM.js?");

/***/ }),

/***/ "./pages/easydam/ImageSettings.js":
/*!****************************************!*\
  !*** ./pages/easydam/ImageSettings.js ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/element */ \"@wordpress/element\");\n/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_0__);\n\nconst ImageSettings = () => {\n  return (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", null, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"h2\", {\n    className: \"py-2 border-b text-xl font-bold\"\n  }, \"Image - Global Settings\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"form\", {\n    id: \"easydam-video-settings\",\n    className: \"flex flex-col\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"py-3 flex flex-col gap-2\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"label\", {\n    className: \"block text-base font-semibold\",\n    htmlFor: \"sync_from_easydam\"\n  }, \"Image delivery\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"label\", {\n    className: \"font-semibold text-[14px] text-base\",\n    htmlFor: \"sync_from_easydam\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"input\", {\n    id: \"sync_from_easydam\",\n    type: \"checkbox\",\n    name: \"sync_from_easydam\",\n    value: \"direct\"\n  }), \"Sync and deliver images from EasyDAM.\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"text-slate-500\"\n  }, \"If you turn this setting off, your images will be delivered from WordPress.\")), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"hr\", null), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"pt-3 flex flex-col gap-1\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"label\", {\n    className: \"block text-base font-semibold\",\n    htmlFor: \"optimize_image\"\n  }, \"Image optimization\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"label\", {\n    className: \"font-semibold text-[14px]\",\n    htmlFor: \"optimize_image\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"input\", {\n    className: \"mr-4\",\n    id: \"optimize_image\",\n    type: \"checkbox\",\n    name: \"optimize_image\",\n    value: \"direct\"\n  }), \"Optimize images on my site.\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"text-slate-500\"\n  }, \"Images will be delivered using Cloudinary\\u2019s automatic format and quality algorithms for the best tradeoff between visual quality and file size. Use Advanced Optimization options to manually tune format and quality.\")), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"pt-3 flex flex-col gap-1\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"label\", {\n    className: \"block text-base font-semibold\",\n    htmlFor: \"image_format\"\n  }, \"Image format\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"select\", {\n    className: \"form-select form-select-lg\",\n    name: \"image_format\",\n    id: \"image_format\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", null, \"Not set\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    selected: true,\n    value: \"auto\"\n  }, \"Auto\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    value: \"png\"\n  }, \"PNG\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    value: \"jpg\"\n  }, \"JPG\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    value: \"webp\"\n  }, \"WebP\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    value: \"avif\"\n  }, \"AVIF\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    value: \"gif\"\n  }, \"GIF\")), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"text-slate-500\"\n  }, \"The image format to use for delivery. Leave as Auto to automatically deliver the most optimal format based on the user's browser and device.\")), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"pt-3 flex flex-col gap-1\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"label\", {\n    className: \"block text-base font-semibold\",\n    htmlFor: \"image_quality\"\n  }, \"Video quality\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"select\", {\n    className: \"form-select form-select-lg\",\n    name: \"image_quality\",\n    id: \"image_quality\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", null, \"Not set\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    selected: true,\n    value: \"auto\"\n  }, \"Auto\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    selected: true,\n    value: \"auto-best\"\n  }, \"Auto best\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    selected: true,\n    value: \"auto-good\"\n  }, \"Auto good\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    selected: true,\n    value: \"auto-eco\"\n  }, \"Auto eco\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    selected: true,\n    value: \"auto-low\"\n  }, \"Auto low\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    selected: true,\n    value: \"100\"\n  }, \"100\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    selected: true,\n    value: \"80\"\n  }, \"80\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    selected: true,\n    value: \"60\"\n  }, \"60\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    selected: true,\n    value: \"40\"\n  }, \"40\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    selected: true,\n    value: \"20\"\n  }, \"20\")), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"text-slate-500\"\n  }, \"Videos will be delivered using EasyDAM\\u2019s automatic format and quality algorithms for the best tradeoff between visual quality and file size. Use Advanced Optimization options to manually tune format and quality.\"))));\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ImageSettings);\n\n//# sourceURL=webpack://EasyDAM/./pages/easydam/ImageSettings.js?");

/***/ }),

/***/ "./pages/easydam/VideoSettings.js":
/*!****************************************!*\
  !*** ./pages/easydam/VideoSettings.js ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/element */ \"@wordpress/element\");\n/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_0__);\n\nconst VideoSettings = () => {\n  return (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", null, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"h2\", {\n    className: \"py-2 border-b text-xl font-bold\"\n  }, \"Video - Global Settings\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"form\", {\n    id: \"easydam-video-settings\",\n    className: \"flex flex-col\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"py-3 flex flex-col gap-2\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"label\", {\n    className: \"block text-base font-semibold\",\n    htmlFor: \"sync_from_easydam\"\n  }, \"Video delivery\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"label\", {\n    className: \"font-semibold text-[14px] text-base\",\n    htmlFor: \"sync_from_easydam\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"input\", {\n    id: \"sync_from_easydam\",\n    type: \"checkbox\",\n    name: \"sync_from_easydam\",\n    value: \"direct\"\n  }), \"Sync and deliver videos from EasyDAM.\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"text-slate-500\"\n  }, \"If you turn this setting off, your videos will be delivered from WordPress.\")), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"hr\", null), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"py-3 flex flex-col gap-2\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"label\", {\n    className: \"block text-base font-semibold\",\n    htmlFor: \"abs\"\n  }, \"Adaptive Bitrate Streaming\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"label\", {\n    className: \"font-semibold text-[14px] text-base\",\n    htmlFor: \"abs\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"input\", {\n    id: \"abs\",\n    type: \"checkbox\",\n    name: \"abs\",\n    value: \"direct\"\n  }), \"Enable Adaptive Bitrate Streaming.\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"text-slate-500\"\n  }, \"If enabled, Transcoder will generate multiple video files with different bitrates for adaptive streaming. This feature is only available for paid subscriptions.\")), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"hr\", null), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", null, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"py-3 flex flex-col gap-1\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"label\", {\n    className: \"block text-base font-semibold\",\n    htmlFor: \"optimize_video\"\n  }, \"Video optimization\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"label\", {\n    className: \"font-semibold text-[14px]\",\n    htmlFor: \"optimize_video\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"input\", {\n    className: \"mr-4\",\n    id: \"optimize_video\",\n    type: \"checkbox\",\n    name: \"optimize_video\",\n    value: \"direct\"\n  }), \"Optimize videos on my site.\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"text-slate-500\"\n  }, \"Videos will be delivered using EasyDAM\\u2019s automatic format and quality algorithms for the best tradeoff between visual quality and file size. Use Advanced Optimization options to manually tune format and quality.\")), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"flex flex-col gap-1\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"label\", {\n    className: \"block text-base font-semibold\",\n    htmlFor: \"video_format\"\n  }, \"Video format\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"select\", {\n    className: \"form-select form-select-lg\",\n    name: \"video_format\",\n    id: \"video_format\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", null, \"Not set\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    selected: true,\n    value: \"auto\"\n  }, \"Auto\")), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"text-slate-500\"\n  }, \"The video format to use for delivery. Leave as Auto to automatically deliver the most optimal format based on the user's browser and device..\")), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"py-3 flex flex-col gap-1\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"label\", {\n    className: \"block text-base font-semibold\",\n    htmlFor: \"video_quality\"\n  }, \"Video quality\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"select\", {\n    className: \"form-select form-select-lg\",\n    name: \"video_quality\",\n    id: \"video_quality\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", null, \"Not set\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    selected: true,\n    value: \"auto\"\n  }, \"Auto\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    selected: true,\n    value: \"auto-best\"\n  }, \"Auto best\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    selected: true,\n    value: \"auto-good\"\n  }, \"Auto good\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    selected: true,\n    value: \"auto-eco\"\n  }, \"Auto eco\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    selected: true,\n    value: \"auto-low\"\n  }, \"Auto low\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    selected: true,\n    value: \"100\"\n  }, \"100\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    selected: true,\n    value: \"80\"\n  }, \"80\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    selected: true,\n    value: \"60\"\n  }, \"60\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    selected: true,\n    value: \"40\"\n  }, \"40\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"option\", {\n    selected: true,\n    value: \"20\"\n  }, \"20\")), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"text-slate-500\"\n  }, \"Videos will be delivered using EasyDAM\\u2019s automatic format and quality algorithms for the best tradeoff between visual quality and file size. Use Advanced Optimization options to manually tune format and quality.\"))), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"hr\", null), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"py-3 flex flex-col gap-2 opacity-90 relative px-3 mt-3\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"absolute bg-orange-400 bg-opacity-10 inset-0 rounded-lg border border-orange-200\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"button\", {\n    className: \"px-3 py-2 rounded font-semibold border border-orange-300 bg-orange-200 border-500 absolute top-0 right-0\"\n  }, \"Premium feature\")), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"label\", {\n    className: \"block text-base font-semibold\",\n    htmlFor: \"abs\"\n  }, \"Watermark\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"label\", {\n    className: \"font-semibold text-[14px] text-base\",\n    htmlFor: \"video_watermark\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"input\", {\n    id: \"video_watermark\",\n    type: \"checkbox\",\n    name: \"video_watermark\",\n    checked: true\n  }), \"Disable video watermark\"), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"text-slate-500\"\n  }, \"If enabled, Transcoder will add a watermark to the transcoded video. This feature is only available for paid subscriptions.\"))));\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (VideoSettings);\n\n//# sourceURL=webpack://EasyDAM/./pages/easydam/VideoSettings.js?");

/***/ }),

/***/ "./pages/easydam/index.js":
/*!********************************!*\
  !*** ./pages/easydam/index.js ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/element */ \"@wordpress/element\");\n/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var react_dom__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react-dom */ \"react-dom\");\n/* harmony import */ var react_dom__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react_dom__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var _EasyDAM__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./EasyDAM */ \"./pages/easydam/EasyDAM.js\");\n/* harmony import */ var _VideoSettings__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./VideoSettings */ \"./pages/easydam/VideoSettings.js\");\n/* harmony import */ var _ImageSettings__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./ImageSettings */ \"./pages/easydam/ImageSettings.js\");\n/* harmony import */ var _Analytics__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./Analytics */ \"./pages/easydam/Analytics.js\");\n\n/**\n * External dependencies\n */\n\n\n/**\n * Internal dependencies\n */\n\n\n\n\n\nconst App = () => {\n  const [activeTab, setActiveTab] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.useState)('video-settings');\n  const tabs = [\n  // {\n  // \tid: 'easydam',\n  // \tlabel: 'EasyDAM',\n  // \tcomponent: EasyDAM,\n  // },\n  {\n    id: 'video-settings',\n    label: 'Video settings',\n    component: _VideoSettings__WEBPACK_IMPORTED_MODULE_3__[\"default\"]\n  }, {\n    id: 'image-settings',\n    label: 'Image settings',\n    component: _ImageSettings__WEBPACK_IMPORTED_MODULE_4__[\"default\"]\n  }\n  // {\n  // \tid: 'analytics',\n  // \tlabel: 'Analytics',\n  // \tcomponent: Analytics,\n  // },\n  ];\n  return (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.Fragment, null, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"wrap flex min-h-[80vh] gap-4 my-4\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"max-w-[220px] w-full rounded-lg bg-white\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"nav\", {\n    className: \"sticky-navbar\"\n  }, tabs.map(tab => (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"a\", {\n    key: tab.id,\n    href: `#${tab.id}`,\n    className: `outline-none block p-4 border-gray-200 font-bold first:rounded-t-lg ${activeTab === tab.id ? 'bg-indigo-500 text-white font-bold border-r-0 hover:text-white focus:text-white focus:ring-2' : ''}`,\n    onClick: () => {\n      setActiveTab(tab.id);\n    }\n  }, tab.label)))), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    id: \"main-content\",\n    className: \"w-full p-5 bg-white rounded-lg border\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"flex gap-5\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"w-full\"\n  }, tabs.map(tab => activeTab === tab.id && (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(tab.component, {\n    key: tab.id\n  }))), (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"div\", {\n    className: \"quick-analytics-share-link max-w-[400px] w-full\"\n  }, (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(\"a\", {\n    href: \"https://www.google.com\",\n    target: \"_blank\",\n    rel: \"noreferrer\"\n  }, \"Quick Analytics Share Link\"))))));\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (App);\nreact_dom__WEBPACK_IMPORTED_MODULE_1___default().render((0,_wordpress_element__WEBPACK_IMPORTED_MODULE_0__.createElement)(App, null), document.getElementById('root-easydam'));\n\n//# sourceURL=webpack://EasyDAM/./pages/easydam/index.js?");

/***/ }),

/***/ "react-dom":
/*!***************************!*\
  !*** external "ReactDOM" ***!
  \***************************/
/***/ ((module) => {

module.exports = ReactDOM;

/***/ }),

/***/ "@wordpress/element":
/*!*********************************!*\
  !*** external ["wp","element"] ***!
  \*********************************/
/***/ ((module) => {

module.exports = wp.element;

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = __webpack_require__("./pages/easydam/index.js");
/******/ 	
/******/ })()
;