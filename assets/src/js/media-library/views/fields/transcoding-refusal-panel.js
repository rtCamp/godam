/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { isRefusal } from '../../transcoding-status/refusal';

const PANEL_CLASS = 'godam-transcoding-refusal';

const PLANS_URL = 'https://app.godam.io/web/billing?tab=Plans';

/**
 * Build an element with a class and optional text.
 *
 * @param {string} tag       Tag name.
 * @param {string} className Class name.
 * @param {string} text      Text content.
 *
 * @return {HTMLElement} The element.
 */
const el = ( tag, className, text = '' ) => {
	const node = document.createElement( tag );
	node.className = className;
	node.textContent = text;

	return node;
};

/**
 * Send the file for transcoding again, and say what happened in the panel.
 *
 * @param {Object}      model  The attachment model.
 * @param {HTMLElement} button The Retranscode button.
 * @param {HTMLElement} status Where the outcome is written.
 */
const retranscode = async ( model, button, status ) => {
	button.disabled = true;
	status.textContent = __( 'Sending…', 'godam' );

	try {
		const response = await apiFetch( {
			path: '/godam/v1/transcoding/retranscode',
			method: 'POST',
			data: { id: model.get( 'id' ) },
		} );

		if ( response?.sent ) {
			status.textContent = __( 'Transcoding has started.', 'godam' );
			return;
		}

		// Refused again: the route's message says why.
		status.textContent = response?.message || __( 'This file can\'t be transcoded.', 'godam' );
	} catch ( error ) {
		status.textContent = error?.message || __( 'The request failed. Try again.', 'godam' );
	}

	button.disabled = false;
};

/**
 * Show why GoDAM Central refused to transcode an attachment, at the top of the
 * attachment details sidebar: the plain reason, what to do about it, and Central's own
 * wording for support.
 *
 * @param {Object} view An Attachment.Details view (one- or two-column).
 */
const renderTranscodingRefusalPanel = ( view ) => {
	const model = view.model;
	const info = view.el.querySelector( '.attachment-info' );

	view.el.querySelectorAll( `.${ PANEL_CLASS }` ).forEach( ( node ) => node.remove() );

	if ( ! info || 'failed' !== model.get( 'transcoding_status' ) || ! isRefusal( model.get( 'transcoding_error_code' ) ) ) {
		return;
	}

	const panel = el( 'div', PANEL_CLASS );
	panel.setAttribute( 'role', 'status' );

	panel.append(
		el( 'p', `${ PANEL_CLASS }__title`, __( 'This file couldn\'t be transcoded', 'godam' ) ),
		el( 'p', `${ PANEL_CLASS }__reason`, model.get( 'transcoding_error_msg' ) || __( 'This file can\'t be transcoded.', 'godam' ) ),
	);

	const actions = el( 'div', `${ PANEL_CLASS }__actions` );
	const status = el( 'p', `${ PANEL_CLASS }__status` );

	if ( model.get( 'transcoding_error_needs_plan' ) ) {
		const upgrade = el( 'a', 'button', __( 'Upgrade plan', 'godam' ) );
		upgrade.href = PLANS_URL;
		upgrade.target = '_blank';
		upgrade.rel = 'noopener noreferrer';
		actions.append( upgrade );
	}

	if ( model.get( 'transcoding_can_retranscode' ) ) {
		const button = el( 'button', 'button', __( 'Retranscode', 'godam' ) );
		button.type = 'button';
		button.addEventListener( 'click', () => retranscode( model, button, status ) );
		actions.append( button );
	}

	if ( actions.childElementCount ) {
		panel.append( actions );
	}

	panel.append( status );

	const detail = model.get( 'transcoding_error_detail' );

	if ( detail ) {
		const details = el( 'details', `${ PANEL_CLASS }__details` );
		details.append(
			el( 'summary', '', __( 'Details for support', 'godam' ) ),
			el( 'p', '', detail ),
		);
		panel.append( details );
	}

	info.prepend( panel );
};

export default renderTranscodingRefusalPanel;
