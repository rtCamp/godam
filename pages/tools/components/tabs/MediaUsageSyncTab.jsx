/**
 * External dependencies
 */
import axios from 'axios';

/**
 * WordPress dependencies
 */
import { Button, Panel, PanelBody, Notice } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { useState, useEffect, useRef } from '@wordpress/element';

/**
 * Internal dependencies
 */
import ProgressBar from '../ProgressBar.jsx';

const apiBase = () => `${ window.godamRestRoute?.url }godam/v1/media-backfill`;
const headers = () => ( {
	'Content-Type': 'application/json',
	'X-WP-Nonce': window.godamRestRoute?.nonce,
} );

const POLL_INTERVAL_MS = 4000;

const MediaUsageSyncTab = () => {
	const [ status, setStatus ] = useState( 'idle' ); // idle | running | stopped | completed
	const [ processed, setProcessed ] = useState( 0 );
	const [ total, setTotal ] = useState( 0 );
	const [ starting, setStarting ] = useState( false );
	const [ stopping, setStopping ] = useState( false );
	const [ notice, setNotice ] = useState( { message: '', type: 'info', visible: false } );

	const pollRef = useRef( null );

	const applyStatusData = ( data ) => {
		setStatus( data.status );
		setProcessed( data.processed );
		setTotal( data.total );
	};

	const fetchStatus = async () => {
		try {
			const res = await axios.get( `${ apiBase() }/status`, { headers: headers() } );
			applyStatusData( res.data );
			return res.data.status;
		} catch {
			return null;
		}
	};

	const stopPolling = () => {
		if ( pollRef.current ) {
			clearInterval( pollRef.current );
			pollRef.current = null;
		}
	};

	const startPolling = () => {
		if ( pollRef.current ) {
			return;
		}
		pollRef.current = setInterval( async () => {
			const nextStatus = await fetchStatus();
			if ( nextStatus !== 'running' ) {
				stopPolling();
				if ( nextStatus === 'completed' ) {
					setNotice( {
						message: __( 'Media usage sync completed successfully.', 'godam' ),
						type: 'success',
						visible: true,
					} );
				}
			}
		}, POLL_INTERVAL_MS );
	};

	// On mount, check whether a backfill is already in progress.
	useEffect( () => {
		fetchStatus().then( ( s ) => {
			if ( s === 'running' ) {
				startPolling();
			}
		} );
		return () => stopPolling();
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [] );

	const handleStart = async () => {
		setStarting( true );
		setNotice( { ...notice, visible: false } );

		try {
			const res = await axios.post( `${ apiBase() }/start`, {}, { headers: headers() } );
			applyStatusData( res.data );

			if ( res.data.status === 'running' ) {
				startPolling();
			} else if ( res.data.status === 'completed' ) {
				setNotice( {
					message: __( 'All posts are already synced — nothing to do.', 'godam' ),
					type: 'success',
					visible: true,
				} );
			}
		} catch ( err ) {
			setNotice( {
				message: err.response?.data?.message ||
					__( 'Failed to start the sync. Please try again.', 'godam' ),
				type: 'error',
				visible: true,
			} );
		} finally {
			setStarting( false );
		}
	};

	const handleStop = async () => {
		setStopping( true );

		try {
			const res = await axios.post( `${ apiBase() }/stop`, {}, { headers: headers() } );
			applyStatusData( res.data );
			stopPolling();
			setNotice( {
				message: sprintf(
					// translators: 1: posts synced so far, 2: total posts to sync.
					__( 'Sync stopped. %1$d of %2$d posts were synced. You can resume at any time.', 'godam' ),
					res.data.processed,
					res.data.total,
				),
				type: 'info',
				visible: true,
			} );
		} catch ( err ) {
			setNotice( {
				message: err.response?.data?.message ||
					__( 'Failed to stop the sync. Please try again.', 'godam' ),
				type: 'error',
				visible: true,
			} );
		} finally {
			setStopping( false );
		}
	};

	const primaryButtonLabel = () => {
		if ( status === 'running' ) {
			return __( 'Syncing…', 'godam' );
		}
		if ( status === 'stopped' ) {
			return __( 'Resume Sync', 'godam' );
		}
		if ( status === 'completed' ) {
			return __( 'Re-run Sync', 'godam' );
		}
		return __( 'Start Sync', 'godam' );
	};

	const showProgress = status === 'running' || status === 'stopped' || ( status === 'completed' && total > 0 );

	const progressLabel = () => {
		if ( status === 'running' ) {
			return sprintf(
				// translators: 1: posts synced so far, 2: total posts to sync.
				__( '%1$d of %2$d posts synced…', 'godam' ),
				processed,
				total,
			);
		}
		if ( status === 'stopped' ) {
			return sprintf(
				// translators: 1: posts synced so far, 2: total posts to sync.
				__( '%1$d of %2$d posts synced (stopped).', 'godam' ),
				processed,
				total,
			);
		}
		return sprintf(
			// translators: %d: total number of posts synced.
			__( '%d posts synced.', 'godam' ),
			total,
		);
	};

	return (
		<>
			<div className="status-notices-container">
				{ notice.visible && (
					<Notice
						status={ notice.type }
						className="my-2"
						onRemove={ () => setNotice( { ...notice, visible: false } ) }
					>
						{ notice.message }
					</Notice>
				) }
			</div>

			<Panel header={ __( 'Media Usage Sync', 'godam' ) } className="godam-panel">
				<PanelBody opened>
					<p>
						{ __(
							'Scans all existing posts and pages to record which media files are used where. Run this once for content that was published before GoDAM tracking was enabled.',
							'godam',
						) }
					</p>
					<p>
						<i>
							{ __(
								'The sync runs in the background in small batches, so your site stays responsive throughout.',
								'godam',
							) }
						</i>
					</p>

					{ showProgress && (
						<div className="my-5">
							<p className="text-gray-600">{ progressLabel() }</p>
							<ProgressBar done={ processed } total={ total } />
						</div>
					) }

					<div className="flex gap-2 mt-4">
						<Button
							variant="primary"
							className="godam-button"
							onClick={ handleStart }
							disabled={ starting || stopping || status === 'running' }
						>
							{ primaryButtonLabel() }
						</Button>

						{ status === 'running' && (
							<Button
								variant="secondary"
								className="godam-button"
								onClick={ handleStop }
								disabled={ stopping }
								style={ { backgroundColor: '#dc3545', color: 'white' } }
							>
								{ stopping
									? __( 'Stopping…', 'godam' )
									: __( 'Stop Sync', 'godam' )
								}
							</Button>
						) }
					</div>
				</PanelBody>
			</Panel>
		</>
	);
};

export default MediaUsageSyncTab;
