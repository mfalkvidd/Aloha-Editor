/*!
 * This file is part of Aloha Editor
 * Author & Copyright (c) 2010 Gentics Software GmbH, aloha@gentics.com
 * Licensed unter the terms of http://www.aloha-editor.com/license.html
 */
(function(window, undefined) {
	"use strict";
	var
		jQuery = window.alohaQuery || window.jQuery, $ = jQuery,
		GENTICS = window.GENTICS,
		Aloha = window.Aloha,
		Ext = window.Ext,
		console = window.console||false,
		Class = window.Class;

/**
 * Aloha's Floating Menu
 * @namespace Aloha
 * @class FloatingMenu
 * @singleton
 */
Aloha.FloatingMenu = {};

/**
 * Define the default scopes
 * @property
 * @type Object
 */
Aloha.FloatingMenu.scopes = {
	'Aloha.empty' : {
		'name' : 'Aloha.empty',
		'extendedScopes' : [],
		'buttons' : []
	},
	'Aloha.global' : {
		'name' : 'Aloha.global',
		'extendedScopes' : ['Aloha.empty'],
		'buttons' : []
	},
	'Aloha.continuoustext' : {
		'name' : 'Aloha.continuoustext',
		'extendedScopes' : ['Aloha.global'],
		'buttons' : []
	}
};

/**
 * Array of tabs within the floatingmenu
 * @hide
 */
Aloha.FloatingMenu.tabs = [];

/**
 * 'Map' of tabs (for easy access)
 * @hide
 */
Aloha.FloatingMenu.tabMap = {};

/**
 * Flag to mark whether the floatingmenu is initialized
 * @hide
 */
Aloha.FloatingMenu.initialized = false;

/**
 * Array containing all buttons
 * @hide
 */
Aloha.FloatingMenu.allButtons = [];

/**
 * top part of the floatingmenu position
 * @hide
 */
Aloha.FloatingMenu.top = 100;

/**
 * left part of the floatingmenu position
 * @hide
 */
Aloha.FloatingMenu.left = 100;

/**
 * store pinned status - true, if the FloatingMenu is pinned
 * @property
 * @type boolean
 */
Aloha.FloatingMenu.pinned = false;

/**
 * just a reference to the jQuery(window) object, which is used quite often
 */
Aloha.FloatingMenu.window = jQuery(window);

/**
 * define floating menu float behaviour. meant to be adjusted via
 * GENTICS.Aloha.settings.floatingmenu.behaviour
 * set it to 'float' for standard behaviour, or 'topalign' for a fixed fm 
 */
Aloha.FloatingMenu.behaviour = 'float';

/**
 * will only be hounoured when behaviour is set to 'topalign'. Adds a margin,
 * so the floating menu is not directly attached to the top of the page
 */
Aloha.FloatingMenu.marginTop = 0;

/**
 * Initialize the floatingmenu
 * @hide
 */
Aloha.FloatingMenu.init = function() {
	//debugger;
	//console.log('jQuery.store:', jQuery.store, window.jQuery, window.alohaQuery);

	// check for behaviour setting of the floating menu
    if (Aloha.settings.floatingmenu) {
        if (typeof Aloha.settings.floatingmenu.behaviour === 'string') {
            this.behaviour = Aloha.settings.floatingmenu.behaviour;
        }
        if (typeof Aloha.settings.floatingmenu.marginTop === 'number') {
            this.marginTop = Aloha.settings.floatingmenu.marginTop;
        }
    }

	jQuery.storage = new jQuery.store();
	this.currentScope = 'Aloha.global';
	var that = this;
	this.window.unload(function () {
		// store fm position if the panel is pinned to be able to restore it next time
		if (that.pinned) {
			var offset = that.obj.offset();
			jQuery.storage.set('Aloha.FloatingMenu.pinned', 'true');
			jQuery.storage.set('Aloha.FloatingMenu.top', offset.top);
			jQuery.storage.set('Aloha.FloatingMenu.left', offset.left);
			if (Aloha.Log.isInfoEnabled()) {
				Aloha.Log.info(this, 'stored FloatingMenu pinned position {' + offset.left
						+ ', ' + offset.top + '}');
			}
		} else {
			// delete old localStorages
			jQuery.storage.del('Aloha.FloatingMenu.pinned');
			jQuery.storage.del('Aloha.FloatingMenu.top');
			jQuery.storage.del('Aloha.FloatingMenu.left');
		}
		if (that.userActivatedTab) {
			jQuery.storage.set('Aloha.FloatingMenu.activeTab', that.userActivatedTab);
		}
	}).resize(function () {
        if (this.behaviour === 'float') {
			var target = that.calcFloatTarget(Aloha.Selection.getRangeObject());
			if (target) {
				that.floatTo(target);
			}
		}
	});
	this.generateComponent();
	this.initialized = true;
};

/**
 * jQuery reference to the extjs tabpanel
 * @hide
 */
Aloha.FloatingMenu.obj = null;

/**
 * jQuery reference to the shadow obj
 * @hide
 */
Aloha.FloatingMenu.shadow = null;

/**
 * jQuery reference to the panels body wrap div
 * @hide
 */
Aloha.FloatingMenu.panelBody = null;

/**
 * Generate the rendered component for the floatingmenu
 * @hide
 */
Aloha.FloatingMenu.generateComponent = function () {
	//debugger;
	var that = this, pinTab;

	// Initialize and configure the tooltips
	Ext.QuickTips.init();
	Ext.apply(Ext.QuickTips.getQuickTip(), {
		minWidth : 10
	});

	if (this.extTabPanel) {
		// TODO dispose of the ext component
	}
	else {
		// generate the tabpanel object
		this.extTabPanel = new Ext.TabPanel({
			activeTab: 0,
			width: 400, // 336px this fits the multisplit button and 6 small buttons placed in 3 cols
			plain: false,
			draggable: {
				insertProxy: false,
				onDrag : function(e) {
					var pel = this.proxy.getEl();
					this.x = pel.getLeft(true);
					this.y = pel.getTop(true);
					Aloha.FloatingMenu.shadow.hide();
				},
				endDrag : function(e) {
					var top = (Aloha.FloatingMenu.pinned) ? this.y - jQuery(document).scrollTop() : this.y;
					
					that.left = this.x;
					that.top = top;
					this.panel.setPosition(this.x, top);
					Aloha.FloatingMenu.refreshShadow();
					Aloha.FloatingMenu.shadow.show();
				}
			},
			floating: true,
			defaults: {
				autoScroll: true
			},
			layoutOnTabChange : true,
			shadow: false,
			cls: 'aloha-floatingmenu ext-root',
			listeners : {
				'tabchange' : {
					'fn' : function(tabPanel, tab) {
						if (tab.title != that.autoActivatedTab) {
							if (Aloha.Log.isDebugEnabled()) {
								Aloha.Log.debug(that, 'User selected tab ' + tab.title);
							}
							// remember the last user-selected tab
							that.userActivatedTab = tab.title;
						} else {
							if (Aloha.Log.isDebugEnabled()) {
								Aloha.Log.debug(that, 'Tab ' + tab.title + ' was activated automatically');
							}
						}
						that.autoActivatedTab = undefined;
						
						// ok, this is kind of a hack: when the tab changes, we check all buttons for multisplitbuttons (which have the method setActiveDOMElement).
						// if a DOM Element is queued to be set active, we try to do this now.
						// the reason for this is that the active DOM element can only be set when the multisplit button is currently visible.
						jQuery.each(that.allButtons, function(index, buttonInfo) {
							if (typeof buttonInfo.button !== 'undefined'
								&& typeof buttonInfo.button.extButton !== 'undefined'
									&& typeof buttonInfo.button.extButton.setActiveDOMElement === 'function') {
								if (typeof buttonInfo.button.extButton.activeDOMElement !== 'undefined') {
									buttonInfo.button.extButton.setActiveDOMElement(buttonInfo.button.extButton.activeDOMElement);
								}
							}
						});
						
						// adapt the shadow
						Aloha.FloatingMenu.shadow.show();
						Aloha.FloatingMenu.refreshShadow();
					}
				}
			},
			enableTabScroll : true
		});
		
		
	}
	// add the tabs
	jQuery.each(this.tabs, function(index, tab) {
		// let each tab generate its ext component and add them to the panel
		try {
			that.extTabPanel.add(tab.getExtComponent());
		} catch(e) {
			Aloha.Log.error(that,"Error while inserting tab: " + e);
			console.log(tab.getExtComponent());
		}
	});

	// add the dropshadow
	this.shadow = jQuery('<div id="aloha-floatingmenu-shadow" class="aloha-shadow">&#160;</div>');
	jQuery('body').append(this.shadow);

	// add an empty pin tab item, store reference
	pinTab = this.extTabPanel.add({
		title : '&#160;'
	});

	// finally render the panel to the body
	this.extTabPanel.render(document.body);

	// finish the pin element after the FM has rendered (before there are noe html contents to be manipulated
	jQuery(pinTab.tabEl)
		.addClass('aloha-floatingmenu-pin')
		.html('&#160;')
		.mousedown(function (e) {
			that.togglePin();
			e.stopPropagation();
		});

	// a reference to the panels body needed for shadow size & position
	this.panelBody = jQuery('div.aloha-floatingmenu div.x-tab-panel-bwrap');

	// do the visibility
	this.doLayout();

	// bind jQuery reference to extjs obj
	// this has to be done AFTER the tab panel has been rendered
	this.obj = jQuery(this.extTabPanel.getEl().dom);

	if (jQuery.storage.get('Aloha.FloatingMenu.pinned') == 'true') {
		this.togglePin();

		this.top = parseInt(jQuery.storage.get('Aloha.FloatingMenu.top'),10);
		this.left = parseInt(jQuery.storage.get('Aloha.FloatingMenu.left'),10);

		// do some positioning fixes
		if (this.top < 30) {
			this.top = 30;
		}
		if (this.left < 0) {
			this.left = 0;
		}

		if (Aloha.Log.isInfoEnabled()) {
			Aloha.Log.info(this, 'restored FloatingMenu pinned position {' + this.left + ', ' + this.top + '}');
		}

		this.refreshShadow();
	}

	// set the user activated tab stored in a localStorage
	if (jQuery.storage.get('Aloha.FloatingMenu.activeTab')) {
		this.userActivatedTab = jQuery.storage.get('Aloha.FloatingMenu.activeTab');
	}

	// for now, position the panel somewhere
	this.extTabPanel.setPosition(this.left, this.top);

	// disable event bubbling for mousedown, because we don't want to recognize
	// a click into the floatingmenu to be a click into nowhere (which would
	// deactivate the editables)
	this.obj.mousedown(function (e) {
		e.originalEvent.stopSelectionUpdate = true;
		e.stopPropagation();
//		e.stopSelectionUpdate = true;
	});
	this.obj.mouseup(function (e) {
		e.originalEvent.stopSelectionUpdate = true;
	});

	// adjust float behaviour
	if (this.behaviour === 'float') {
		// listen to selectionChanged event
		Aloha.bind('aloha-selection-changed',function(event, rangeObject) {
			if (!that.pinned) {
				var pos = that.calcFloatTarget(rangeObject);
				if (pos) {
					that.floatTo(pos);
				}
			}
		});
    } else if (this.behaviour === 'topalign') {
        // topalign will retain the user's pinned status
        // TODO maybe the pin should be hidden in that case?
        this.togglePin(false);

		// float the fm to each editable that is activated
		Aloha.bind('aloha-editable-activated', function(event, data) {
			var p = data.editable.obj.offset();
			p.top -= 90; //dirty

            if (p.top < $(document).scrollTop()) {
                // scrollpos is below top of editable
                that.obj.css('top', $(document).scrollTop() + that.marginTop);
                that.obj.css('left', p.left);
                that.togglePin(true);
            } else {
                // scroll pos is above top of editable
                that.floatTo(p);
            }
        });

		// fm scroll behaviour
        $(window).scroll(function () {
            if (!Aloha.activeEditable) {
                return;
            }
            var pos = Aloha.activeEditable.obj.offset(),
			    fmHeight = that.obj.height(),
                scrollTop = $(document).scrollTop();

			if (scrollTop > (pos.top - fmHeight - 6 - that.marginTop)) {
                // scroll pos is lower than top of editable
                that.togglePin(true);
                that.obj.css('top', that.marginTop);
            } else if (scrollTop <= (pos.top - fmHeight - 6 - that.marginTop)) {
                // scroll pos is above top of editable
                pos.top -= fmHeight + 6;
                that.togglePin(false);
                that.floatTo(pos);
            } else if (scrollTop > pos.top + Aloha.activeEditable.obj.height() - fmHeight) {
                // scroll pos is past editable
                that.togglePin(false);
            }
		});
    }
};

/**
 * reposition & resize the shadow
 * the shadow must not be repositioned outside this method!
 * position calculation is based on this.top and this.left coordinates
 * @method
 */
Aloha.FloatingMenu.refreshShadow = function (resize) {
	if (this.panelBody) {
		var props = {
			'top': this.top + 24, // 24px top offset to reflect tab bar height
			'left': this.left
		};

		if(typeof resize === 'undefined' || !resize) {
			props.width = this.panelBody.width() + 'px';
			props.height = this.panelBody.height() + 'px';
		}

		Aloha.FloatingMenu.shadow.css(props);
	}
};

/**
 * toggles the pinned status of the floating menu
 * @method
 * @param {boolean} pinned set to true to activate pin, or set to false to deactivate pin. 
 *             leave undefined to toggle pin status automatically
 */
Aloha.FloatingMenu.togglePin = function(pinned) {
	var el = jQuery('.aloha-floatingmenu-pin');
       
    if (typeof pinned === 'boolean') {
        this.pinned = !pinned;
    }
       
	if (this.pinned) {
		el.removeClass('aloha-floatingmenu-pinned');
		this.top = this.obj.offset().top;

		this.obj.removeClass('fixed').css({
			'top': this.top
		});

		this.shadow.removeClass('fixed');
		this.refreshShadow();

		this.pinned = false;
	} else {
		el.addClass('aloha-floatingmenu-pinned');
		this.top = this.obj.offset().top - this.window.scrollTop();

		this.obj.addClass('fixed').css({
			'top': this.top // update position for fixed position
		});

		// do the same for the shadow
		this.shadow.addClass('fixed');//props.start
		this.refreshShadow();

		this.pinned = true;
	}
};

/**
 * Create a new scopes
 * @method
 * @param {String} scope name of the new scope (should be namespaced for uniqueness)
 * @param {String} extendedScopes Array of scopes this scope extends. Can also be a single String if
 *            only one scope is extended, or omitted if the scope should extend
 *            the empty scope
 */
Aloha.FloatingMenu.createScope = function(scope, extendedScopes) {
	if (typeof extendedScopes === 'undefined') {
		extendedScopes = ['Aloha.empty'];
	} else if (typeof extendedScopes === 'string') {
		extendedScopes = [extendedScopes];
	}

	// TODO check whether the extended scopes already exist

	if (this.scopes[scope]) {
		// TODO what if the scope already exists?
	} else {
		// generate the new scope
		this.scopes[scope] = {'name' : scope, 'extendedScopes' : extendedScopes, 'buttons' : []};
	}
};

/**
 * Adds a button to the floatingmenu
 * @method
 * @param {String} scope the scope for the button, should be generated before (either by core or the plugin)
 * @param {Button} button instance of Aloha.ui.button to add at the floatingmenu
 * @param {String} tab label of the tab to which the button is added
 * @param {int} group index of the button group in the tab, lowest index is left
 */
Aloha.FloatingMenu.addButton = function(scope, button, tab, group) {
	// check whether the scope exists
	var
		scopeObject = this.scopes[scope],
		buttonInfo, tabObject, groupObject;
	
	if (typeof scopeObject === 'undefined') {
		// TODO log an error and exit
	}

	// generate a buttonInfo object
	buttonInfo = {'button' : button, 'scopeVisible' : false};

	// add the button to the list of all buttons
	this.allButtons.push(buttonInfo);

	// add the button to the scope
	scopeObject.buttons.push(buttonInfo);

	// get the tab object
	tabObject = this.tabMap[tab];
	if (typeof tabObject === 'undefined') {
		// the tab object does not yet exist, so create a new tab and add it to the list
		tabObject = new Aloha.FloatingMenu.Tab(tab);
		this.tabs.push(tabObject);
		this.tabMap[tab] = tabObject;
	}

	// get the group
	groupObject = tabObject.getGroup(group);

	// now add the button to the group
	groupObject.addButton(buttonInfo);

	// finally, when the floatingmenu is already initialized, we need to create the ext component now
	if (this.initialized) {
		this.generateComponent();
	}
};

/**
 * Recalculate the visibility of tabs, groups and buttons (depending on scope and button hiding)
 * @hide
 */
Aloha.FloatingMenu.doLayout = function () {
	if (Aloha.Log.isDebugEnabled()) {
		Aloha.Log.debug(this, 'doLayout called for FloatingMenu, scope is ' + this.currentScope);
	}
	//debugger;
	var that = this,
		firstVisibleTab = false,
		activeExtTab = this.extTabPanel.getActiveTab(),
		activeTab = false,
		floatingMenuVisible = false,
		showUserActivatedTab = false,
		pos;

	// let the tabs layout themselves
	jQuery.each(this.tabs, function(index, tab) {
		// remember the active tab
		if (tab.extPanel == activeExtTab) {
			activeTab = tab;
		}

		// remember whether the tab is currently visible
		var tabVisible = tab.visible;

		// let each tab generate its ext component and add them to the panel
		if (tab.doLayout()) {
			// found a visible tab, so the floatingmenu needs to be visible as well
			floatingMenuVisible = true;

			// make sure the tabstrip is visible
			if (!tabVisible) {
				if (Aloha.Log.isDebugEnabled()) {
					Aloha.Log.debug(that, 'showing tab strip for tab ' + tab.label);
				}
				that.extTabPanel.unhideTabStripItem(tab.extPanel);
			}

			// remember the first visible tab
			if (!firstVisibleTab) {
				// this is the first visible tab (in case we need to switch to it)
				firstVisibleTab = tab;
			}

			// check whether this visible tab is the last user activated tab and currently not active
			if (that.userActivatedTab == tab.extPanel.title && tab.extPanel != activeExtTab) {
				showUserActivatedTab = tab;
			}
		} else {
			// make sure the tabstrip is hidden
			if (tabVisible) {
				if (Aloha.Log.isDebugEnabled()) {
					Aloha.Log.debug(that, 'hiding tab strip for tab ' + tab.label);
				}
				that.extTabPanel.hideTabStripItem(tab.extPanel);
			}
		}
	});

	// check whether the last tab which was selected by the user is visible and not the active tab
	if (showUserActivatedTab) {
		if (Aloha.Log.isDebugEnabled()) {
			Aloha.Log.debug(this, 'Setting active tab to ' + showUserActivatedTab.label);
		}
		this.extTabPanel.setActiveTab(showUserActivatedTab.extPanel);
	} else if (typeof activeTab === 'object' && typeof firstVisibleTab === 'object') {
		// now check the currently visible tab, whether it is visible and enabled
		if (!activeTab.visible) {
			if (Aloha.Log.isDebugEnabled()) {
				Aloha.Log.debug(this, 'Setting active tab to ' + firstVisibleTab.label);
			}
			this.autoActivatedTab = firstVisibleTab.extPanel.title;
			this.extTabPanel.setActiveTab(firstVisibleTab.extPanel);
		}
	}

	// set visibility of floatingmenu
	if (floatingMenuVisible && this.extTabPanel.hidden) {
		// set the remembered position
		this.extTabPanel.show();
		this.refreshShadow();
		this.shadow.show();
		this.extTabPanel.setPosition(this.left, this.top);
	} else if (!floatingMenuVisible && !this.extTabPanel.hidden) {
		// remember the current position
		pos = this.extTabPanel.getPosition(true);
		// restore previous position if the fm was pinned
		this.left = pos[0] < 0 ? 100 : pos[0];
		this.top = pos[1] < 0 ? 100 : pos[1];
		this.extTabPanel.hide();
		this.shadow.hide();
	}

	// let the Ext object render itself again
	this.extTabPanel.doLayout();
};

/**
 * Set the current scope
 * @method
 * @param {String} scope name of the new current scope
 */
Aloha.FloatingMenu.setScope = function(scope) {
	// get the scope object
	var scopeObject = this.scopes[scope];

	if (typeof scopeObject === 'undefined') {
		// TODO log an error
	} else if (this.currentScope != scope) {
		this.currentScope = scope;

		// first hide all buttons
		jQuery.each(this.allButtons, function(index, buttonInfo) {
			buttonInfo.scopeVisible = false;
		});

		// now set the buttons in the given scope to be visible
		this.setButtonScopeVisibility(scopeObject);

		// finally refresh the layout
		this.doLayout();
	}
};

/**
 * Set the scope visibility of the buttons for the given scope. This method will call itself for the motherscopes of the given scope.
 * @param scopeObject scope object
 * @hide
 */
Aloha.FloatingMenu.setButtonScopeVisibility = function(scopeObject) {
	var that = this;

	// set all buttons in the given scope to be visible
	jQuery.each(scopeObject.buttons, function(index, buttonInfo) {
		buttonInfo.scopeVisible = true;
	});

	// now do the recursion for the motherscopes
	jQuery.each(scopeObject.extendedScopes, function(index, scopeName) {
		var motherScopeObject = that.scopes[scopeName];
		if (typeof motherScopeObject === 'object') {
			that.setButtonScopeVisibility(motherScopeObject);
		}
	});
};

/**
 * returns the next possible float target dom obj
 * the floating menu should only float to h1-h6, p, div, td and pre elements
 * if the current object is not valid, it's parentNode will be considered, until
 * the limit object is hit
 * @param obj the dom object to start from (commonly this would be the commonAncestorContainer)
 * @param limitObj the object that limits the range (this would be the editable)
 * @return dom object which qualifies as a float target
 * @hide
 */
Aloha.FloatingMenu.nextFloatTargetObj = function (obj, limitObj) {
	// if we've hit the limit object we don't care for it's type
	if (!obj || obj == limitObj) {
		return obj;
	}

	// fm will only float to h1-h6, p, div, td
	switch (obj.nodeName.toLowerCase()) {
		case 'h1':
		case 'h2':
		case 'h3':
		case 'h4':
		case 'h5':
		case 'h6':
		case 'p':
		case 'div':
		case 'td':
		case 'pre':
		case 'ul':
		case 'ol':
			return obj;
		default:
			return this.nextFloatTargetObj(obj.parentNode, limitObj);
	}
};

/**
 * calculates the float target coordinates for a range
 * @param range the fm should float to
 * @return object containing left and top coordinates, like { left : 20, top : 43 }
 * @hide
 */
Aloha.FloatingMenu.calcFloatTarget = function(range) {
	var
		i, editableLength, target,
		targetObj, scrollTop, top;

	// TODO in IE8 somteimes a broken range is handed to this function - investigate this
	if (!Aloha.activeEditable || typeof range.getCommonAncestorContainer === 'undefined') {
		return false;
	}

	// check if the designated editable is disabled
	for ( i = 0, editableLength = Aloha.editables.length; i < editableLength; i++) {
		if (Aloha.editables[i].obj.get(0) == range.limitObject &&
				Aloha.editables[i].isDisabled()) {
			return false;
		}
	}

	target = this.nextFloatTargetObj(range.getCommonAncestorContainer(), range.limitObject);
	if ( ! target ) {
		return false;
	}

	targetObj = jQuery(target);
	scrollTop = GENTICS.Utils.Position.Scroll.top;
	if (!targetObj || !targetObj.offset()) {
		return false;
	}
	top = targetObj.offset().top - this.obj.height() - 50; // 50px offset above the current obj to have some space above

	// if the floating menu would be placed higher than the top of the screen...
	if ( top < scrollTop) {
		top += 50 + GENTICS.Utils.Position.ScrollCorrection.top;
	}

	// if the floating menu would float off the bottom of the screen
	// we don't want it to move, so we'll return false
	if (top > this.window.height() + this.window.scrollTop()) {
		return false;
	}

	return {
		left : Aloha.activeEditable.obj.offset().left,
		top : top
	};
};

/**
 * float the fm to the desired position
 * the floating menu won't float if it is pinned
 * @method
 * @param {Object} coordinate object which has a left and top property
 */
Aloha.FloatingMenu.floatTo = function(position) {
	// no floating if the panel is pinned
	if (this.pinned) {
		return;
	}

	var that = this,
	    fmpos = this.obj.offset();

	// move to the new position
	if (fmpos.left != position.left || fmpos.top != position.top) {
		this.obj.animate({
			top:  position.top,
			left: position.left
		}, {
			queue : false,
			step : function (step, props) {
				// update position reference
				if (props.prop == 'top') {
					that.top = props.now;
				} else if (props.prop == 'left') {
					that.left = props.now;
				}

				that.refreshShadow(false);
			}
		});
	}
};

/**
 * Constructor for a floatingmenu tab
 * @namespace Aloha.FloatingMenu
 * @class Tab
 * @constructor
 * @param {String} label label of the tab
 */
Aloha.FloatingMenu.Tab = Class.extend({
	_constructor: function(label) {
		this.label = label;
		this.groups = [];
		this.groupMap = {};
		this.visible = true;
	},

	/**
	 * Get the group with given index. If it does not yet exist, create a new one
	 * @method
	 * @param {int} group group index of the group to get
	 * @return group object
	 */
	getGroup: function(group) {
		var groupObject = this.groupMap[group];
		if (typeof groupObject === 'undefined') {
			groupObject = new Aloha.FloatingMenu.Group();
			this.groupMap[group] = groupObject;
			this.groups.push(groupObject);
			// TODO resort the groups
		}

		return groupObject;
	},

	/**
	 * Get the EXT component representing the tab
	 * @return EXT component (EXT.Panel)
	 * @hide
	 */
	getExtComponent: function () {
		var that = this;

		if (typeof this.extPanel === 'undefined') {
			// generate the panel here
			this.extPanel = new Ext.Panel({
				'tbar' : [],
				'title' : this.label,
				'style': 'margin-top:0px',
				'bodyStyle': 'display:none',
				'autoScroll': true
			});

			// add the groups
			jQuery.each(this.groups, function(index, group) {
				// let each group generate its ext component and add them to the panel
				that.extPanel.getTopToolbar().add(group.getExtComponent());
			});
		}

		return this.extPanel;
	},

	/**
	 * Recalculate the visibility of all groups within the tab
	 * @hide
	 */
	doLayout: function() {
		var that = this;

		if (Aloha.Log.isDebugEnabled()) {
			Aloha.Log.debug(this, 'doLayout called for tab ' + this.label);
		}
		this.visible = false;

		// check all groups in this tab
		jQuery.each(this.groups, function(index, group) {
			that.visible |= group.doLayout();
		});

		if (Aloha.Log.isDebugEnabled()) {
			Aloha.Log.debug(this, 'tab ' + this.label + (this.visible ? ' is ' : ' is not ') + 'visible now');
		}

		return this.visible;
	}
});

/**
 * Constructor for a floatingmenu group
 * @namespace Aloha.FloatingMenu
 * @class Group
 * @constructor
 */
Aloha.FloatingMenu.Group = Class.extend({
	_constructor: function() {
		this.buttons = [];
		this.fields = [];
	},

	/**
	 * Add a button to this group
	 * @param {Button} buttonInfo to add to the group
	 */
	addButton: function(buttonInfo) {
		if (buttonInfo.button instanceof Aloha.ui.AttributeField) {
			if (this.fields.length < 2) {
				this.fields.push(buttonInfo);
			} else {
				throw new Error("Too much fields in this group");
			}
		} else {
			// Every plugin API entryPoint (method) should be securised enough
			// to avoid Aloha to block at startup even
			// if a plugin is badly designed
			if (typeof buttonInfo.button !== "undefined"){
				this.buttons.push(buttonInfo);
			}
		}
	},

	/**
	 * Get the EXT component representing the group (Ext.ButtonGroup)
	 * @return the Ext.ButtonGroup
	 * @hide
	 */
	getExtComponent: function () {
		var that = this, l,
			items = [],
			buttonCount = 0,
			columnCount = 0,
			len, idx, half;


		if (typeof this.extButtonGroup === 'undefined') {
			
			if (this.fields.length > 1) {
				columnCount = 1;
			}

			jQuery.each(this.buttons, function(index, button) {
				// count the number of buttons (large buttons count as 2)
				buttonCount += button.button.size == 'small' ? 1 : 2;
			});
			columnCount = columnCount + Math.ceil(buttonCount / 2);

			len = this.buttons.length;
			idx = 0;
			half =  Math.ceil(this.buttons.length / 2) - this.buttons.length % 2 ;

			if (this.fields.length > 0) {
				that.buttons.push(this.fields[0]);
				items.push(this.fields[0].button.getExtConfigProperties());
			}

			while (--len >= half) {
				items.push(this.buttons[idx++].button.getExtConfigProperties());
			}
			++len;
			if (this.fields.length > 1) {
				that.buttons.push(this.fields[1]);
				items.push(this.fields[1].button.getExtConfigProperties());
			}
			while (--len >=0) {
				items.push(this.buttons[idx++].button.getExtConfigProperties());
			}

			this.extButtonGroup = new Ext.ButtonGroup({
				'columns' : columnCount,
				'items': items
			});
//			jQuery.each(this.fields, function(id, field){
//				that.buttons.push(field);
//			});
			// now find the Ext.Buttons and set to the GENTICS buttons
			jQuery.each(this.buttons, function(index, buttonInfo) {
				buttonInfo.button.extButton = that.extButtonGroup.findById(buttonInfo.button.id);
				// the following code is a work arround because ExtJS initializes later.
				// The ui wrapper store the information and here we use it... ugly.
				// if there are any listeners added before initializing the extButtons
				if ( buttonInfo.button.listenerQueue && buttonInfo.button.listenerQueue.length > 0 ) {
					while ( true ) {
						l = buttonInfo.button.listenerQueue.shift();
						if ( !l ) {break;}
						buttonInfo.button.extButton.addListener(l.eventName, l.handler, l.scope, l.options);
					}
				}
				if (buttonInfo.button.extButton.setObjectTypeFilter) {
					if (buttonInfo.button.objectTypeFilter) {
						buttonInfo.button.extButton.noQuery = false;
					}
					if ( buttonInfo.button.objectTypeFilter == 'all' ) {
						buttonInfo.button.objectTypeFilter = null;
					}
					buttonInfo.button.extButton.setObjectTypeFilter(buttonInfo.button.objectTypeFilter);
					if ( buttonInfo.button.displayField) {
						buttonInfo.button.extButton.displayField = buttonInfo.button.displayField;
					}
					if ( buttonInfo.button.tpl ) {
						buttonInfo.button.extButton.tpl = buttonInfo.button.tpl;
					}
				}
			});
		}

		return this.extButtonGroup;
	},

	/**
	 * Recalculate the visibility of the buttons and the group
	 * @hide
	 */
	doLayout: function () {
		var groupVisible = false,
			that = this;
		jQuery.each(this.buttons, function(index, button) {
			if (typeof button.button !== "undefined") {
				var extButton = that.extButtonGroup.findById(button.button.id),
				buttonVisible = button.button.isVisible() && button.scopeVisible;
				
				if (buttonVisible && extButton.hidden) {
					extButton.show();
				} else if (!buttonVisible && !extButton.hidden) {
					extButton.hide();
				}
				
				groupVisible |= buttonVisible;
			}
		});
		if (groupVisible && this.extButtonGroup.hidden) {
			this.extButtonGroup.show();
		} else if (!groupVisible && !this.extButtonGroup.hidden) {
			this.extButtonGroup.hide();
		}
		
		return groupVisible;

	}
});

})(window);
