/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import { TextControl } from '@wordpress/components';

const LicenseKey = () => {
	const [ licenseKey, setLicenseKey ] = useState( '' );
	const [ status, setStatus ] = useState( null );

	const saveLicenseKey = () => {
		// Logic to save the license key, e.g., make a REST API call
		// Example placeholder logic:
		if ( licenseKey.trim() ) {
			// Replace with actual save logic
			setStatus( { type: 'success', message: 'License key saved successfully!' } );
		} else {
			setStatus( { type: 'error', message: 'Please enter a valid license key.' } );
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
			<button
				className="p-2 bg-indigo-500 text-white rounded"
				onClick={ saveLicenseKey }
			>
				Save License Key
			</button>
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
