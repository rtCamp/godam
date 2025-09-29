/**
 * External dependencies
 */

/**
 * WordPress dependencies
 */
import {
	Button,
	Panel,
	PanelBody,
	Icon,
	ExternalLink,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import axios from 'axios';
/**
 * Internal dependencies
 */
import ProgressBar from '../../ProgressBar.jsx';
import { useState, useEffect, useRef, useCallback } from '@wordpress/element';
import { error } from '@wordpress/icons';

const VimeoVideoMigration = ( { migrationStatus, setMigrationStatus, showNotice } ) => {
	const intervalRef = useRef( null );
	const noticeShownRef = useRef( { completed: false, failed: false } );
	const [ godamMigrationCompleted, setGodamMigrationCompleted ] = useState( true );

	const handleMigrationClick = async () => {
		const url = window.godamRestRoute?.url + 'godam/v1/video-migrate';

		// Optimistically set UI to processing so users get instant feedback.
		setMigrationStatus( ( prev ) => ( {
			...( prev || {} ),
			total: 0,
			done: 0,
			started: Date.now(),
			completed: null,
			status: 'processing',
			message: __( 'Starting…', 'godam' ),
		} ) );

		axios.post( url, {
			type: 'vimeo',
		},
		{
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': window.godamRestRoute?.nonce,
			},
		} )
			.then( ( response ) => {
				// Check the status in the response data
				if ( response.data?.message?.migration_status && response.data.message.migration_status !== 'Completed' ) {
					setGodamMigrationCompleted( false );
					setMigrationStatus( { total: 0, done: 0, started: null, completed: null, status: 'pending', message: '' } );
				} else {
					// Proceed with migration
					setMigrationStatus( response.data );
				}
			} )
			.catch( ( err ) => {
				// Check if status is 400, set godamMigrationStatus
				if ( err.response && err.response.status === 400 ) {
					setGodamMigrationCompleted( false );
				}
				// Reset UI as request failed; show an error notice for clarity.
				setMigrationStatus( { total: 0, done: 0, started: null, completed: null, status: 'pending', message: '' } );
				const apiMessage = __( 'Something went wrong while starting migration.', 'godam' );
				showNotice( apiMessage, 'error' );
			} );
	};

	const handleAbortClick = async () => {
		// stop polling immediately
		if ( intervalRef.current ) {
			clearInterval( intervalRef.current );
			intervalRef.current = null;
		}

		const url = window.godamRestRoute?.url + 'godam/v1/video-migrate/abort';
		try {
			const response = await axios.post( url,
				{ type: 'vimeo' },
				{
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': window.godamRestRoute?.nonce,
					},
				},
			);

			const data = response?.data || {};
			showNotice( `${ data?.message || '' }`, 'warning' );

			// Reset UI to initial state
			setMigrationStatus( { total: 0, done: 0, started: null, completed: null, status: 'pending', message: '' } );
		} catch ( e ) {
			setMigrationStatus( { total: 0, done: 0, started: null, completed: null, status: 'pending', message: '' } );
		}
	};

	const fetchMigrationStatus = useCallback( async () => {
		const url = window.godamRestRoute?.url + 'godam/v1/video-migration/status?type=vimeo';

		try {
			const response = await axios.get( url, {
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.godamRestRoute?.nonce,
				},
			} );
			setMigrationStatus( response.data );
		} catch ( err ) {}
	}, [ setMigrationStatus ] );

	// Start polling when migration is processing
	useEffect( () => {
		if ( migrationStatus?.status === 'processing' ) {
			// Clear any existing interval
			if ( intervalRef.current ) {
				clearInterval( intervalRef.current );
			}

			// Start polling every 5 seconds
			intervalRef.current = setInterval( fetchMigrationStatus, 5000 );

			// Reset notice flags for a new run
			noticeShownRef.current = { completed: false, failed: false };
		}

		// Stop polling when migration is not processing
		if ( migrationStatus?.status !== 'processing' && intervalRef.current ) {
			clearInterval( intervalRef.current );
			intervalRef.current = null;
		}

		// Set notice based on migration status (only once per run)
		if ( migrationStatus?.status === 'completed' && ! noticeShownRef.current.completed ) {
			noticeShownRef.current.completed = true;
			showNotice( __( 'Vimeo Video Migration has been successfully completed for all posts and pages 🎉', 'godam' ), 'success' );
		} else if ( migrationStatus?.status === 'failed' && ! noticeShownRef.current.failed ) {
			noticeShownRef.current.failed = true;
			showNotice( __( 'Vimeo Video Migration failed. Please try again.', 'godam' ), 'error' );
		}

		// Cleanup interval on component unmount
		return () => {
			if ( intervalRef.current ) {
				clearInterval( intervalRef.current );
			}
		};
	}, [ migrationStatus?.status, fetchMigrationStatus, showNotice ] );

	if ( ! migrationStatus ) {
		return (
			<div className="bg-white p-6 rounded-md godam-panel">
				<div className="flex-1 space-y-8 py-1">
					<div className="h-2 max-w-xs rounded bg-gray-200"></div>
					<div className="space-y-3">
						<div className="h-2 rounded bg-gray-200"></div>
						<div className="grid grid-cols-3 gap-4">
							<div className="col-span-2 h-2 rounded bg-gray-200"></div>
							<div className="col-span-1 h-2 rounded bg-gray-200"></div>
						</div>
						<div className="h-8 max-w-[120px] rounded bg-gray-200"></div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<>
			<Panel className="godam-panel">
				<PanelBody title={ __( 'Vimeo video Migration', 'godam' ) } initialOpen={ false }>
					<p>
						{ __( 'This tool replaces WordPress Vimeo Embed blocks with GoDAM Video blocks. It does not replace Vimeo videos added in the WordPress Classic Editor.', 'godam' ) }
					</p>

					<div className="flex items-center gap-2">
						<Icon icon={ error } className="w-4 h-4" style={ { fill: '#EAB308' } } />
						<p className="text-center m-0 text-[#AB3A6C]">{ __( 'This migrator will only migrate Vimeo videos that are already fetched on GoDAM Central.', 'godam' ) }</p>
						<ExternalLink href={ `${ window.godamRestRoute?.apiBase }/web` } className="godam-url">{ __( 'Open', 'godam' ) }</ExternalLink>
					</div>

					{ /* Progressbar indicating video migration progress */ }
					{ /* Horizontal progressbar, done/total */ }
					{ [ 'processing', 'completed' ].includes( migrationStatus?.status ) && (
						<div>
							<ProgressBar showInitialProgress={ 'processing' === migrationStatus?.status } done={ migrationStatus?.done } total={ migrationStatus?.total } />
							<div className="mt-1 mb-3 px-1 py-[1px] bg-gray-200 inline-flex rounded">{ migrationStatus?.message }</div>
						</div>
					) }

					{
						! godamMigrationCompleted && (
							<div className="godam-migration-status my-2 bg-gray-100 p-2 rounded">
								{ __( 'Vimeo video migration in WordPress can only begin after all Vimeo videos have been successfully migrated to GoDAM Central, ', 'godam' ) }
								<a className="godam-url" href={ `${ window.godamRestRoute?.apiBase || 'https://app.godam.io' }/web/settings` } target="_blank" rel="noreferrer">
									{ __( 'Check here!', 'godam' ) }
								</a>
							</div>
						)
					}

					{ /* Migration status */ }
					{ migrationStatus?.status === 'processing' && (
						<div className="godam-migration-status my-2">
							{ __( 'Migration is in progress. Please wait…', 'godam' ) }
						</div>
					)
					}

					{ /* Migration actions */ }
					{ migrationStatus?.status === 'processing' ? (
						<Button
							variant="secondary"
							onClick={ handleAbortClick }
							className="godam-button mt-2"
						>
							{ __( 'Abort', 'godam' ) }
						</Button>
					) : (
						<Button
							variant="primary"
							onClick={ handleMigrationClick }
							className="godam-button mt-2"
							disabled={ ! migrationStatus }
						>
							{ migrationStatus?.status === 'completed' ? __( 'Restart Migration', 'godam' ) : __( 'Start Migration', 'godam' ) }
						</Button>
					) }
				</PanelBody>
			</Panel>
		</>
	);
};

export default VimeoVideoMigration;
