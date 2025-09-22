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
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import axios from 'axios';
/**
 * Internal dependencies
 */
import ProgressBar from '../../ProgressBar.jsx';
import { useEffect, useRef, useCallback } from '@wordpress/element';

const CoreVideoMigration = ( { migrationStatus, setMigrationStatus, showNotice } ) => {
	const intervalRef = useRef( null );
	const noticeShownRef = useRef( { completed: false, failed: false } );

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
			type: 'core',
		},
		{
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': window.godamRestRoute?.nonce,
			},
		} )
			.then( ( response ) => {
				setMigrationStatus( response.data );
			} )
			.catch( ( err ) => {
				// Reset UI as request failed; show an error notice for clarity.
				setMigrationStatus( { total: 0, done: 0, started: null, completed: null, status: 'pending', message: '' } );
				const apiMessage = err?.response?.data?.message || err?.message || __( 'Something went wrong while starting migration.', 'godam' );
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
				{ type: 'core' },
				{
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': window.godamRestRoute?.nonce,
					},
				},
			);

			// Show tooltip/notice with processed counts
			const data = response?.data || {};
			showNotice( `${ data?.message || '' }`, 'warning' );

			// Reset UI to initial state
			setMigrationStatus( { total: 0, done: 0, started: null, completed: null, status: 'pending', message: '' } );
		} catch ( e ) {
			// Reset anyway so UI is not stuck
			setMigrationStatus( { total: 0, done: 0, started: null, completed: null, status: 'pending', message: '' } );
		}
	};

	const fetchMigrationStatus = useCallback( async () => {
		const url = window.godamRestRoute?.url + 'godam/v1/video-migration/status?type=core';

		try {
			const response = await axios.get( url, {
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.godamRestRoute?.nonce,
				},
			} );
			setMigrationStatus( response.data );
		} catch ( error ) {
			// Optionally handle error, e.g., show a notification instead of using console
		}
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
			showNotice( __( 'WordPress core video migration completed successfully 🎉', 'godam' ), 'success' );
		} else if ( migrationStatus?.status === 'failed' && ! noticeShownRef.current.failed ) {
			noticeShownRef.current.failed = true;
			showNotice( __( 'WordPress core video migration failed. Please try again.', 'godam' ), 'error' );
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
				<PanelBody title={ __( 'Core video Migration', 'godam' ) } initialOpen={ false }>
					<p className="m-0">
						{ __( 'This tool replaces WordPress core video blocks with GoDAM video blocks. It does not replace videos added in the WordPress Classic Editor.', 'godam' ) }
					</p>

					{ /* Progressbar indicating video migration progress */ }
					{ /* Horizontal progressbar, done/total */ }
					{ [ 'processing', 'completed' ].includes( migrationStatus?.status ) && (
						<div>
							<ProgressBar showInitialProgress={ 'processing' === migrationStatus?.status } done={ migrationStatus?.done } total={ migrationStatus?.total } />
							<div className="mt-1 mb-3 px-1 py-[1px] bg-gray-200 inline-flex rounded">{ migrationStatus?.message }</div>
						</div>
					) }

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

export default CoreVideoMigration;
