/* global MediaLibraryCategoryFilterData */

let MediaCategoryFilter = wp?.media?.view?.AttachmentFilters;

MediaCategoryFilter = MediaCategoryFilter?.extend( {
	createFilters() {
		const filters = {};
		filters.all = {
			text: 'All Categories',
			props: { media_category: '' },
		};

		MediaLibraryCategoryFilterData.terms.forEach( ( term ) => {
			filters[ term.slug ] = {
				text: term.name,
				props: { media_category: term.slug },
			};
		} );

		this.filters = filters;
	},
} );

export default MediaCategoryFilter;
