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
	const [ majorReleaseData, setFeatures ] = useState( {} );
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

				const resData = await response.json();

				// Set state on valid response data.
				if ( resData && resData.features && resData.features.length > 0 ) {
					setFeatures( resData );
				}
			} catch ( error ) {
				setHasError( true );
			} finally {
				setIsLoading( false );
			}
		};

		fetchData();
	}, [] );

	useEffect( () => {
		// Dispatch event on successful data fetch,
		// mainly used for modal interactivity.
		if ( majorReleaseData.features && majorReleaseData.features.length > 0 ) {
			document.dispatchEvent( new CustomEvent( 'whatsNewContentReady' ) );
		}
	}, [ majorReleaseData ] );

	if ( isLoading ) {
		// Loading state
		return <Loading />;
	} else if ( hasError || ! majorReleaseData.features || majorReleaseData.features.length === 0 ) {
		// Error state or no data
		return <Error hasError={ hasError } />;
	}

	// New plugin features
	return <Features majorReleaseData={ majorReleaseData } />;
};

export default App;
