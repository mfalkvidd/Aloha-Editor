// Ensure Namespace
window.GENTICS = window.GENTICS || {};
window.GENTICS.Utils = window.GENTICS.Utils || {};
window.Aloha = window.Aloha || {};
window.Aloha.settings = window.Aloha.settings || {};
window.Aloha.ui = window.Aloha.ui || {};
window.Aloha_loaded_plugins = window.Aloha_loaded_plugins || [];
window.Aloha_pluginDir = window.Aloha_pluginDir || false;
window.Aloha_base = window.Aloha_base || false;

// Handle
(function(window,undefined) {

	// alohaQuery should always be available
	window.alohaQuery = window.alohaQuery||window.jQuery;

	// Variables
	var
		// jQuery
		jQuery = window.alohaQuery || window.jQuery, $ = jQuery;
	