/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { getDocsSearchUrl } from '../constants.js';
import HubIcon from './HubIcon.jsx';

/**
 * Site-wide docs search.
 *
 * Submitting hands the query to the GoDAM site search in a new tab, the same
 * way the docs landing page does.
 */
const DocsSearch = () => {
	const [ query, setQuery ] = useState( '' );

	const handleSubmit = ( event ) => {
		event.preventDefault();

		const term = query.trim();

		if ( ! term ) {
			return;
		}

		window.open( getDocsSearchUrl( term ), '_blank', 'noopener,noreferrer' );
	};

	const label = __( 'Search the GoDAM documentation', 'godam' );

	return (
		<form className="godam-help-search" role="search" onSubmit={ handleSubmit }>
			<input
				className="godam-help-search__input"
				type="search"
				value={ query }
				onChange={ ( event ) => setQuery( event.target.value ) }
				placeholder={ __( 'Search the docs — e.g. “image hotspots”, “transcoding”, “shoppable video”', 'godam' ) }
				aria-label={ label }
				autoComplete="off"
			/>
			<button className="godam-help-search__submit" type="submit" aria-label={ label }>
				<HubIcon name="search" />
			</button>
		</form>
	);
};

export default DocsSearch;
