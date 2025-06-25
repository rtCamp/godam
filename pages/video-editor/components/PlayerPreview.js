/**
 * External dependencies
 */
import { useState, useEffect, useLayoutEffect } from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { createPortal, useCallback } from '@wordpress/element';
import { Button } from '@wordpress/components';

const PlayerPreview = ( {
	isOpen,
	onClose,
	attachmentId,
} ) => {
	const [ previewHtml, setPreviewHtml ] = useState( '' );
	const [ loading, setLoading ] = useState( false );
	const [ error, setError ] = useState( null );

	const updatePreview = useCallback( async () => {
		if ( ! attachmentId || ! isOpen ) {
			return;
		}

		setLoading( true );
		setError( null );

		try {
			const response = await apiFetch( {
				path: '/wp-json/godam/v1/player-preview/' + attachmentId,
				method: 'GET',
			} );

			setPreviewHtml( response.html || '' );
		} catch ( apiError ) {
			setError( apiError.message || __( 'An error occurred while fetching the preview.', 'godam' ) );
		} finally {
			setLoading( false );
		}
	}, [ isOpen, attachmentId ] );

	// Fetch preview when modal opens or attachmentId changes
	useEffect( () => {
		if ( isOpen && attachmentId ) {
			updatePreview();
		}
	}, [ isOpen, attachmentId, updatePreview ] );

	// Initialize player when HTML content changes
	useLayoutEffect( () => {
		if ( previewHtml && window.GODAMPlayer && isOpen ) {
			try {
				window.GODAMPlayer();
			} catch ( playerError ) {
				setError( __( 'Failed to initialize GODAMPlayer. Please check your player configuration.', 'godam' ) );
			}
		}
	}, [ previewHtml, isOpen ] );

	// Handle escape key press.
	useEffect( () => {
		const handleEscape = ( event ) => {
			if ( event.key === 'Escape' && isOpen ) {
				onClose();
			}
		};

		if ( isOpen ) {
			document.addEventListener( 'keydown', handleEscape );
		}

		return () => {
			document.removeEventListener( 'keydown', handleEscape );
		};
	}, [ isOpen, onClose ] );

	if ( ! isOpen ) {
		return null;
	}

	return createPortal(
		<div className="fixed top-0 left-0 w-screen h-screen z-[100000] p-24 flex items-center justify-center bg-black bg-opacity-85">
			<Button
				onClick={ onClose }
				variant="primary"
				className="absolute top-10 right-10"
				aria-label={ __( 'Close player preview', 'godam' ) }
			>
				{ __( 'Close', 'godam' ) }
			</Button>

			<div className="max-w-[70vw] w-full">
				{ loading && (
					<div className="flex items-center justify-center h-64">
						<div className="text-center">
							<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
							<p className="text-gray-600">{ __( 'Loading preview', 'godam' ) }</p>
						</div>
					</div>
				) }

				{ error && (
					<div className="flex items-center justify-center h-64">
						<div className="text-center">
							<div className="text-red-500 text-lg mb-2">⚠️</div>
							<p className="text-red-600">{ error }</p>
							<Button
								onClick={ updatePreview }
								className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
							>
								Retry
							</Button>
						</div>
					</div>
				) }

				{ previewHtml && ! loading && ! error && (
					<div
						dangerouslySetInnerHTML={ { __html: previewHtml } }
						className="max-w-full"
					/>
				) }

				{ ! previewHtml && ! loading && ! error && (
					<div className="flex items-center justify-center h-full w-full">
						<p className="text-gray-500">{ __( 'No preview available', 'godam' ) }</p>
					</div>
				) }

			</div>
		</div>,
		document.body,
	);
};

export default PlayerPreview;
