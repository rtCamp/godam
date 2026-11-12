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
 * Whether a URL from the server is safe to link to.
 *
 * @param {string} url URL.
 *
 * @return {boolean} True for an http(s) URL.
 */
const isLinkable = ( url ) => typeof url === 'string' && /^https?:\/\//i.test( url );

/**
 * Build a link that opens in a new tab.
 *
 * @param {string} className Class name.
 * @param {string} href      URL.
 * @param {string} text      Link text.
 *
 * @return {HTMLAnchorElement} The link.
 */
const link = ( className, href, text ) => {
	const anchor = el( 'a', className, text );
	anchor.href = href;
	anchor.target = '_blank';
	anchor.rel = 'noopener noreferrer';

	return anchor;
};

/**
 * What to say in the panel for the retranscode route's answer. Its `message` names the
 * file (it's written for the Tools log), so the panel uses the plain reason, or its own
 * short copy for the route's other skip reasons.
 *
 * @param {Object} answer The route's JSON answer, from a success or an error.
 *
 * @return {string} One short line.
 */
const describeAnswer = ( answer ) => {
	if ( answer?.sent ) {
		return __( 'Transcoding has started.', 'godam' );
	}

	if ( answer?.error_msg ) {
		return answer.error_msg;
	}

	switch ( answer?.reason ) {
		case 'local_environment':
			return __( 'Transcoding isn\'t available on a localhost site.', 'godam' );
		case 'storage_exceeded':
			return __( 'Your GoDAM storage is full. Upgrade your plan to continue transcoding.', 'godam' );
		case 'http_auth_enabled':
			return __( 'HTTP authentication is enabled on this site. Disable it to allow transcoding.', 'godam' );
		default:
			return __( 'The request failed. Try again.', 'godam' );
	}
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

		status.textContent = describeAnswer( response );

		if ( response?.sent ) {
			return;
		}
	} catch ( error ) {
		// apiFetch rejects with the route's JSON body on an error status.
		status.textContent = describeAnswer( error );
	}

	button.disabled = false;
};

/**
 * The panel's heading for each kind of failure (see rtgodam_get_transcoding_failure()).
 *
 * @param {string} kind The failure's kind.
 *
 * @return {string} The heading.
 */
const titleFor = ( kind ) => {
	switch ( kind ) {
		case 'retrying':
			return __( 'Transcoding will be retried', 'godam' );
		case 'stalled':
			return __( 'Transcoding is taking longer than expected', 'godam' );
		default:
			return __( 'This file couldn\'t be transcoded', 'godam' );
	}
};

/**
 * Show why a file's transcode failed or seems stuck, at the top of the attachment details
 * sidebar: the reason, what to do about it, and for a refusal Central's own wording for
 * support.
 *
 * Everything shown comes from `transcoding_failure` (rtgodam_get_transcoding_failure_for_display()),
 * which is always the plugin's own translated wording, never Central's raw error.
 *
 * @param {Object} view An Attachment.Details view (one- or two-column).
 */
const renderTranscodingRefusalPanel = ( view ) => {
	const model = view.model;
	const info = view.el.querySelector( '.attachment-info' );
	const failure = model.get( 'transcoding_failure' );

	view.el.querySelectorAll( `.${ PANEL_CLASS }` ).forEach( ( node ) => node.remove() );

	if ( ! info || ! failure?.message ) {
		return;
	}

	// A stuck file is still `queued` or `transcoding`; anything else must have failed.
	if ( 'stalled' !== failure.kind && 'failed' !== model.get( 'transcoding_status' ) ) {
		return;
	}

	const panel = el( 'div', PANEL_CLASS );
	panel.setAttribute( 'role', 'status' );

	panel.append(
		el( 'p', `${ PANEL_CLASS }__title`, titleFor( failure.kind ) ),
		el( 'p', `${ PANEL_CLASS }__reason`, failure.message ),
	);

	// "Upload a smaller file" and the like: nothing to click, so say it.
	if ( failure.next_step && ! failure.next_step_url && String( failure.action ).startsWith( 'upload_' ) ) {
		panel.append( el( 'p', `${ PANEL_CLASS }__next-step`, failure.next_step ) );
	}

	const actions = el( 'div', `${ PANEL_CLASS }__actions` );
	const status = el( 'p', `${ PANEL_CLASS }__status` );

	if ( failure.next_step && isLinkable( failure.next_step_url ) ) {
		actions.append( link( 'button', failure.next_step_url, failure.next_step ) );
	}

	// While the plugin is still retrying on its own, a manual retry would only race it.
	if ( model.get( 'transcoding_can_retranscode' ) && 'retrying' !== failure.kind ) {
		const button = el( 'button', 'button', __( 'Retranscode', 'godam' ) );
		button.type = 'button';
		button.addEventListener( 'click', () => retranscode( model, button, status ) );
		actions.append( button );
	}

	if ( isLinkable( failure.support_url ) ) {
		actions.append( link( `${ PANEL_CLASS }__support`, failure.support_url, __( 'Contact support', 'godam' ) ) );
	}

	if ( actions.childElementCount ) {
		panel.append( actions );
	}

	panel.append( status );

	const detail = isRefusal( failure.code ) ? model.get( 'transcoding_error_detail' ) : '';

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
