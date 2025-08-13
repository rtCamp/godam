/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import Loading from './components/Loading';
import Error from './components/Error';
import Features from './components/Features';

const App = () => {
	const [ releaseData, setFeatures ] = useState( {} );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ hasError, setHasError ] = useState( false );

	useEffect( () => {
		const fetchData = async () => {
			try {
				setIsLoading( true );
				setHasError( false );

				const response = await fetch( '/wp-json/godam/v1/release-post' );

				if ( ! response.ok ) {
					throw new Error( 'Failed to fetch data' );
				}

				const data = await response.json();

				// Set state on valid response data.
				if ( data && data.features && data.features.length > 0 ) {
					setFeatures( data );
				}
			} catch ( error ) {
				setHasError( true );
			} finally {
				setIsLoading( false );
			}
		};

		fetchData();
	}, [] );

	if ( isLoading ) {
		// Loading state
		return <Loading />;
	} else if ( hasError || ! releaseData.features || releaseData.features.length === 0 ) {
		// Error state or no data
		return <Error hasError={ hasError } />;
	}

	// New plugin features
	return <Features releaseData={ releaseData } />;
};

export default App;
