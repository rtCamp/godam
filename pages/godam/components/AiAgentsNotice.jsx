/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Button, ExternalLink } from '@wordpress/components';
import { close } from '@wordpress/icons';
import apiFetch from '@wordpress/api-fetch';

const NOTICE_PATH = '/godam/v1/ai-agents/notice';

/**
 * "You can now use GoDAM from your AI agent" notice.
 *
 * Shown to administrators on GoDAM's pages when the MCP Adapter plugin is
 * active and GoDAM's MCP switch is on. The show state comes from, and the
 * dismissal is saved through, the `ai-agents/notice` REST route, so nothing has
 * to be localized onto every admin page. A site without the route (WordPress
 * older than 6.9) simply shows nothing.
 *
 * @return {JSX.Element|null} The notice, or null.
 */
const AiAgentsNotice = () => {
	const [ notice, setNotice ] = useState( null );

	useEffect( () => {
		// The Video Editor needs the height; the notice shows on the other pages.
		if ( new URLSearchParams( window.location.search ).get( 'page' ) === 'rtgodam_media_editor' ) {
			return;
		}

		apiFetch( { path: NOTICE_PATH } )
			.then( ( data ) => {
				if ( data?.show ) {
					setNotice( data );
				}
			} )
			.catch( () => {} );
	}, [] );

	if ( ! notice ) {
		return null;
	}

	const dismiss = () => {
		setNotice( null );
		apiFetch( { path: NOTICE_PATH, method: 'POST' } ).catch( () => {} );
	};

	return (
		<div
			className="godam-ai-agents-notice -ml-[32px] border-b bg-indigo-50 pl-[32px]"
			data-test-id="godam-header-notice-ai-agents"
		>
			<div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm text-slate-900">
				<span>
					<strong>{ __( 'New: use GoDAM from your AI agent.', 'godam' ) }</strong>
					{ ' ' }
					{ __( 'Claude, Cursor and other AI agents can now work with your GoDAM media on this site.', 'godam' ) }
				</span>
				<Button variant="link" href={ notice.settingsUrl } data-test-id="godam-header-button-ai-agents-setup">
					{ __( 'Connect your agent', 'godam' ) }
				</Button>
				<ExternalLink href={ notice.docsUrl }>
					{ __( 'Read the guide', 'godam' ) }
				</ExternalLink>
				<Button
					className="ml-auto"
					size="small"
					icon={ close }
					label={ __( 'Dismiss this notice', 'godam' ) }
					onClick={ dismiss }
					data-test-id="godam-header-button-ai-agents-dismiss"
				/>
			</div>
		</div>
	);
};

export default AiAgentsNotice;
