/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { TextControl, Spinner, Button } from '@wordpress/components';

const LicenseKey = () => {
	const [ licenseKey, setLicenseKey ] = useState( '' );
	const [ status, setStatus ] = useState( null );
	const [ isLoading, setIsLoading ] = useState( false ); // State for loading indicator.

	// Fetch the saved license key on component mount.
	useEffect( () => {
		const fetchLicenseKey = async () => {
			try {
				const response = await fetch( '/wp-json/transcoder/v1/get-license-key', {
					method: 'GET',
					headers: {
						'X-WP-Nonce': window.wpApiSettings.nonce,
					},
				} );

				if ( response.ok ) {
					const result = await response.json();
					setLicenseKey( result.license_key || '' );
				}
			} catch ( error ) {
				console.error( 'Failed to fetch the license key.', error );
			}
		};

		fetchLicenseKey();
	}, [] );

	const saveLicenseKey = async () => {
		if ( ! licenseKey.trim() ) {
			setStatus( { type: 'error', message: 'Please enter a valid license key.' } );
			return;
		}

		setIsLoading( true ); // Show loading indicator.

		try {
			const response = await fetch( '/wp-json/transcoder/v1/verify-license', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
				body: JSON.stringify( { license_key: licenseKey } ),
			} );

			const result = await response.json();

			if ( response.ok ) {
				setStatus( { type: 'success', message: result.message || 'License key verified successfully!' } );
			} else {
				setStatus( { type: 'error', message: result.message || 'Failed to verify the license key.' } );
			}
		} catch ( error ) {
			setStatus( { type: 'error', message: 'An error occurred. Please try again later.' } );
		} finally {
			setIsLoading( false ); // Hide loading indicator.
		}
	};

	return (
		<div>
			<h2 className="py-2 border-b text-xl font-bold">License Key</h2>
			<div className="my-4">
				<TextControl
					label="Enter License Key"
					value={ licenseKey }
					onChange={ ( value ) => setLicenseKey( value ) }
					help="Your license key is required to access premium features."
					placeholder="Enter your license key here"
					className="max-w-[400px]"
				/>
			</div>
			<Button
				className="max-w-[140px] w-full flex justify-center items-center"
				onClick={ saveLicenseKey }
				disabled={ isLoading }
				variant="primary"
			>
				{ isLoading ? <Spinner /> : 'Save License Key' }
			</Button>
			{ status && (
				<p
					className={ `mt-2 text-sm ${
						status.type === 'success' ? 'text-green-600' : 'text-red-600'
					}` }
				>
					{ status.message }
				</p>
			) }
		</div>
	);
};

export default LicenseKey;
