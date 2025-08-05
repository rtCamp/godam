/**
 * WordPress dependencies
 */
import { useState, useEffect, useCallback } from '@wordpress/element';
import { __, _x, sprintf } from '@wordpress/i18n';
import { Button, Notice, Panel, PanelBody } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { formatSize, getMediaMigrationInfo } from '../../../utils';

const LoadingDots = () => {
	const dotStyle = ( delay ) => ( {
		animation: `blink 1.4s infinite both`,
		animationDelay: `${ delay }s`,
	} );

	return (
		<span style={ { display: 'inline-block' } }>
			<span style={ dotStyle( 0.2 ) }>.</span>
			<span style={ dotStyle( 0.4 ) }>.</span>
			<span style={ dotStyle( 0.6 ) }>.</span>
			<style>
				{ `
				  @keyframes blink {
					0%, 80%, 100% { opacity: 0; }
					40% { opacity: 1; }
				  }
				` }
			</style>
		</span>
	);
};

const calculatePercentage = ( used, total ) => {
	if ( total === 0 ) {
		return 0;
	}
	try {
		const result = ( used / total ) * 100;
		return result.toFixed( 2 );
	} catch ( error ) {
		return 0;
	}
};

let noticeInfo = false;

const MediaMigration = () => {
	const [ migrationStarted, setMigrationStarted ] = useState( null );
	const [ migrationStopped, setMigrationStopped ] = useState( null );
	const [ requestingInfo, setRequestingInfo ] = useState( false );
	const [ mediaMigrationInfo, setMediaMigrationInfo ] = useState( getMediaMigrationInfo() );

	/**
	 * Function to set the migration state based on the action.
	 *
	 * @param {string}  action - The action to perform, e.g., 'start', 'stop', 'progress'.
	 * @param {boolean} value  - The value to set for the migration state.
	 */
	const setMigrationState = useCallback( ( action, value ) => {
		switch ( action ) {
			case 'start':
				setMigrationStarted( value );
				break;
			case 'stop':
				setMigrationStopped( value );
				break;
			case 'info':
				setRequestingInfo( value );
				break;
		}
	}, [] );

	/**
	 * Function to handle media migration actions.
	 *
	 * @param {string} subAction - The action to perform, e.g., 'start', 'stop', 'info'.
	 *
	 * @return {Promise<void>}
	 */
	const mediaMigration = useCallback( async ( subAction ) => {
		// Check if the migration is already running.
		setMigrationState( subAction, true );

		const response = await fetch( window?.goDAMUploadsData?.ajax_url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams( {
				action: 'godam_handle_files_migration',
				nonce: window?.goDAMUploadsData?.nonce,
				subAction,
			} ),
		} );

		const result = await response.json();
		if ( result.success ) {
			// Update the media migration info state
			if ( 'info' === subAction ) {
				setMediaMigrationInfo( result.data );
			}

			// If the action is 'start', then log the output.
			if ( 'start' === subAction ) {
				noticeInfo = {
					success: true,
					message: __( 'Migration started successfully.', 'godam' ),
				};
			}

			// Update requesting state.
			setMigrationState( subAction, false );
		} else {
			// If the action is 'start', then log the output.
			if ( 'start' === subAction ) {
				noticeInfo = {
					success: false,
					message: result.data?.message || __( 'Failed to start migration.', 'godam' ),
				};
			}

			// Update requesting state.
			setMigrationState( subAction, false );
		}
	}, [ setMigrationState ] );

	/**
	 * Button component to run the media migration.
	 *
	 * @class
	 */
	const RunMigrationButton = () => {
		if ( 'running' === mediaMigrationInfo.status || 'paused' === mediaMigrationInfo.status || 'scheduled' === mediaMigrationInfo.status ) {
			return;
		}

		const isDisabled = mediaMigrationInfo.remaining <= 0;

		return (
			<Button
				variant="secondary"
				className="godam-button godam-migrate-media-button mt-8"
				onClick={ () => mediaMigration( 'start' ) }
				isBusy={ migrationStarted }
				disabled={ isDisabled }
			>
				{ __( 'Run Migration', 'godam' ) }
			</Button>
		);
	};

	/**
	 * Button component to stop the media migration.
	 *
	 * @class
	 */
	const StopMigrationButton = () => {
		if ( 'running' !== mediaMigrationInfo.status && 'paused' !== mediaMigrationInfo.status && 'scheduled' !== mediaMigrationInfo.status ) {
			return;
		}

		return (
			<Button
				variant="secondary"
				className="godam-button godam-migrate-media-button mt-8"
				onClick={ () => mediaMigration( 'stop' ) }
				isBusy={ migrationStopped }
			>
				{ __( 'Stop Migration', 'godam' ) }
			</Button>
		);
	};

	const MigrationStatus = () => {
		switch ( mediaMigrationInfo.status ) {
			case 'idle':
				if ( mediaMigrationInfo.remaining > 0 ) {
					return (
						<i className="text-gray-500">{ __( 'idle', 'godam' ) }</i>
					);
				}
				return (
					<i className="text-green-500">{ __( 'completed', 'godam' ) }</i>
				);
			case 'running':
				return (
					<i className="text-blue-500">{ __( 'running', 'godam' ) }</i>
				);
			case 'scheduled':
				return (
					<i className="text-orange-500">{ __( 'scheduled', 'godam' ) }</i>
				);
			case 'paused':
				return (
					<i className="text-blue-500">{ __( 'running', 'godam' ) }</i>
				);
			case 'error':
				return (
					<i className="text-red-500">{ __( 'error', 'godam' ) }</i>
				);
			default:
				return (
					<i className="text-gray-500">{ __( 'idle', 'godam' ) }</i>
				);
		}
	};

	const ShowNotice = () => {
		switch ( mediaMigrationInfo.status ) {
			case 'idle':
				if ( noticeInfo && ! noticeInfo.success ) {
					return (
						<Notice
							className="mb-4"
							status="error"
							isDismissible={ false }
						>
							{ noticeInfo.message }
						</Notice>
					);
				}
				break;
			case 'running':
			case 'paused':
			case 'scheduled':
				return (
					<Notice
						className="mb-4"
						status={ 'success' }
						isDismissible={ false }
					>
						{ __( 'We\'re migrating your data. You can safely close this tab!', 'godam' ) }
					</Notice>
				);
		}
	};

	const SearchReplaceCommand = () => {
		if ( ! window?.goDAMUploadsData?.search_replace_command || ! window?.goDAMUploadsData?.search_replace_command.length ) {
			return null;
		}

		if ( mediaMigrationInfo.remaining > 0 || ( mediaMigrationInfo.completed + mediaMigrationInfo.failed ) < mediaMigrationInfo.total ) {
			return null;
		}

		return (
			<div className="mt-8 font-mono bg-gray-100 border-1 p-3 rounded">
				<strong className="text-gray-500">{ __( '# Search and replace command for media URLs:', 'godam' ) }</strong>
				<br />
				<span>{ window?.goDAMUploadsData.search_replace_command }</span>
			</div>
		);
	};

	// Set an interval to fetch the media migration info every 5 seconds.
	useEffect( () => {
		const interval = setInterval( () => {
			if ( ! requestingInfo ) {
				mediaMigration( 'info' );
			}
		}, 3000 );

		return () => clearInterval( interval );
	}, [ mediaMigration, requestingInfo ] );

	// Fetch the initial media migration info when the component mounts.
	if ( ! mediaMigrationInfo ) {
		return null;
	}

	return (
		<>
			<Panel header={ __( 'Migrate Media', 'godam' ) } className="godam-panel">
				<PanelBody opened>
					<div className="godam-form-group">
						<ShowNotice />
						<p className="text-sm mt-0">{ __( 'You can migrate your media files to GoDAM storage. This will allow you to use the GoDAM CDN for faster delivery and better performance.', 'godam' ) }</p>
						<div className="flex gap-3 items-center mt-8">
							<div className="circle-container mr-6">
								<div className="data text-xs">{ calculatePercentage( mediaMigrationInfo.total - mediaMigrationInfo.remaining, mediaMigrationInfo.total ) }%</div>
								<div
									className={ `circle` }
									style={ { '--percentage': calculatePercentage( mediaMigrationInfo.total - mediaMigrationInfo.remaining, mediaMigrationInfo.total ) + '%' } }
								></div>
							</div>
							<div className="leading-6 mr-6">
								<div className="easydam-settings-label text-base"><b>{ __( 'GoDAM STORAGE', 'godam' ) }</b></div>
								<strong>{ __( 'Used: ', 'godam' ) }</strong>{ formatSize( parseInt( window?.userData.storage_used ) * 1024 * 1024 * 1024 ) }
								<br />
								<strong>{ __( 'Available: ', 'godam' ) }</strong>{ formatSize( parseInt( window?.userData.total_storage - window?.userData.storage_used ) * 1024 * 1024 * 1024 ) }
							</div>
							<div className="leading-6 mr-6">
								<div className="easydam-settings-label text-base"><b>{ __( 'STATS', 'godam' ) }</b></div>
								<strong>{ __( 'Total Files: ', 'godam' ) }</strong>{ mediaMigrationInfo.total } { _x( 'Files', 'files', 'godam' ) }
								<br />
								<strong>{ __( 'Files Size: ', 'godam' ) }</strong>{ formatSize( mediaMigrationInfo.total_size ) }
							</div>
							<div className="leading-6 mr-6">
								<div className="easydam-settings-label text-base">&nbsp;</div>
								<strong>{ __( 'Remaining Files: ', 'godam' ) }</strong>{ mediaMigrationInfo.remaining } { _x( 'Files', 'files', 'godam' ) }
								<br />
								<strong>{ __( 'Remaining Size: ', 'godam' ) }</strong>{ formatSize( parseInt( mediaMigrationInfo?.remaining_size ) ) }
							</div>
							<div className="leading-6 mr-6">
								<div className="easydam-settings-label text-base">&nbsp;</div>
								<strong>{ __( 'Status: ', 'godam' ) }</strong><MigrationStatus />
								<br />
								{ 'running' === mediaMigrationInfo.status && (
									<>
										<strong>{ __( 'Migrating: ', 'godam' ) }</strong>
										{ mediaMigrationInfo?.migrating?.filename ? sprintf( '%1$s of %2$s', mediaMigrationInfo?.migrating?.filename, formatSize( mediaMigrationInfo?.migrating?.size ) ) : '' } <LoadingDots />
									</>
								) }
								{ 'running' !== mediaMigrationInfo.status && (
									<>
										{ 'paused' === mediaMigrationInfo.status && (
											<><strong>{ __( 'Processing batch', 'godam' ) }</strong><LoadingDots /></>
										) }
										{ 'paused' !== mediaMigrationInfo.status && (
											<><strong>{ __( 'Failed: ', 'godam' ) }</strong>{ mediaMigrationInfo.failed } { _x( 'Files', 'files', 'godam' ) }</>
										) }
									</>
								) }
							</div>
						</div>
					</div>
					<SearchReplaceCommand />
					<RunMigrationButton />
					<StopMigrationButton />
				</PanelBody>
			</Panel>
		</>
	);
};

export default MediaMigration;
