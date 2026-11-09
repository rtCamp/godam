/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import { ToggleControl, Notice, Panel, PanelBody, ExternalLink, Button } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';

/**
 * The "AI agents (MCP)" panel: the on/off switch for GoDAM's MCP server, and
 * how to connect an agent. The switch saves at once through WordPress's own
 * settings route, which only administrators can use.
 *
 * @since n.e.x.t
 *
 * @return {JSX.Element|null} The panel, or nothing for users who are not administrators.
 */
const AiAgentsSettings = () => {
	const data = window?.godamSettings?.aiAgents;
	const [ enabled, setEnabled ] = useState( Boolean( data?.enabled ) );
	const [ saving, setSaving ] = useState( false );
	const [ notice, setNotice ] = useState( null );

	if ( ! data || ! data.available ) {
		return null;
	}

	const handleToggle = async ( value ) => {
		setSaving( true );
		setNotice( null );

		try {
			const response = await apiFetch( {
				path: '/wp/v2/settings',
				method: 'POST',
				data: { rtgodam_mcp_enabled: value },
			} );
			setEnabled( Boolean( response?.rtgodam_mcp_enabled ) );
			setNotice( {
				status: 'success',
				message: value ? __( 'AI agents can now connect to GoDAM.', 'godam' ) : __( 'AI agents can no longer connect to GoDAM.', 'godam' ),
			} );
		} catch ( error ) {
			setNotice( {
				status: 'error',
				message: __( 'The setting could not be saved. Reload the page and try again. If it keeps failing, contact GoDAM support.', 'godam' ),
			} );
		} finally {
			setSaving( false );
		}
	};

	return (
		<Panel header={ __( 'AI agents (MCP)', 'godam' ) } className="godam-panel godam-margin-bottom">
			<PanelBody opened>
				{ notice && (
					<Notice className="godam-margin-bottom" status={ notice.status } onRemove={ () => setNotice( null ) }>
						{ notice.message }
						{ 'error' === notice.status && (
							<>
								{ ' ' }
								<ExternalLink href="https://app.godam.io/helpdesk/my-tickets">{ __( 'Contact support', 'godam' ) }</ExternalLink>
							</>
						) }
					</Notice>
				) }

				<ToggleControl
					__nextHasNoMarginBottom
					className="godam-margin-bottom"
					label={ __( 'Let AI agents connect to GoDAM', 'godam' ) }
					help={ __( 'Lets AI agents such as Claude or Cursor work with your GoDAM media through MCP. Each agent can only do what its WordPress user is allowed to do. When off, GoDAM is hidden from every MCP server on this site. Saves immediately.', 'godam' ) }
					checked={ enabled }
					disabled={ saving }
					onChange={ handleToggle }
					data-test-id="godam-settings-general-control-mcp"
				/>

				{ enabled && (
					<div className="godam-ai-agents__connect">
						{ ! data.adapterSupported && (
							<Notice status="warning" isDismissible={ false } className="godam-margin-bottom">
								{ __( 'Agents connect through the MCP Adapter plugin, version 0.7 or later. Install or update it from WordPress.org first.', 'godam' ) }
								{ ' ' }
								<Button variant="link" href={ data.installAdapterUrl }>{ __( 'Find the MCP Adapter plugin', 'godam' ) }</Button>
							</Notice>
						) }
						<p>
							{ sprintf(
								/* translators: %s: the GoDAM MCP server address. */
								__( 'Server address: %s', 'godam' ),
								data.serverUrl,
							) }
						</p>
						<p>
							{ __( 'Agents sign in with an Application Password of the WordPress user they act as.', 'godam' ) }
							{ ' ' }
							<Button variant="link" href={ data.appPasswordsUrl }>{ __( 'Create an Application Password', 'godam' ) }</Button>
						</p>
						<p>
							{ data.writesEnabled
								? __( 'Agents can make changes as well as read.', 'godam' )
								: __( 'Agents can only read: changes are turned off.', 'godam' ) }
							{ ' ' }
							<Button variant="link" href={ data.writingSettingsUrl }>{ __( 'Change this in Settings › Writing', 'godam' ) }</Button>
						</p>
					</div>
				) }
			</PanelBody>
		</Panel>
	);
};

export default AiAgentsSettings;
