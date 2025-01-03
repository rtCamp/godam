/**
 * Internal dependencies
 */
import '../../libs/jquery-ui-1.14.1.draggable/jquery-ui';
import './transcoding-status';

import AttachmentsBrowser from './views/attachment-browser.js';
import Attachments from './views/attachments.js';

const $ = jQuery;

/**
 * MediaLibrary class.
 */
class MediaLibrary {
	constructor() {
		this.setupAttachmentBrowser();
	}

	setupAttachmentBrowser() {
		if ( wp?.media?.view?.AttachmentsBrowser && AttachmentsBrowser ) {
			wp.media.view.AttachmentsBrowser = AttachmentsBrowser;
		}

		if ( wp?.media?.view?.Attachments && Attachments ) {
			wp.media.view.Attachments = Attachments;
		}
	}
}

const mediaLibrary = new MediaLibrary();

export default mediaLibrary;

document.addEventListener( 'DOMContentLoaded', function() {
	const mediaLibraryRoot = document.createElement( 'div' );
	mediaLibraryRoot.id = 'rt-transcoder-media-library-root';
	const wpbody = document.querySelector( '#wpbody' );
	wpbody.insertBefore( mediaLibraryRoot, wpbody.firstChild );
} );

/**
 * Temp
 */
document.addEventListener( 'DOMContentLoaded', () => {
	const inputElement = document.getElementById( 'media-date-range-filter' );
	const startDateField = document.getElementById( 'media-date-range-filter-start' );
	const endDateField = document.getElementById( 'media-date-range-filter-end' );

	if ( ! inputElement || ! startDateField || ! endDateField ) {
		console.error( 'Required input elements not found.' );
		return;
	}

	let dateQuery;

	// Function to get query parameters from the URL
	const getQueryParam = ( param ) => {
		const urlParams = new URLSearchParams( window.location.search );
		return urlParams.get( param );
	};

	// Function to parse date from query parameter
	const parseDate = ( dateString ) => {
		return moment( dateString, 'YYYY-MM-DD', true ); // Use strict parsing
	};

	// Set initial date range based on the query parameters in the URL
	const initializeDateRangeFromQueryParams = () => {
		const startDateParam = getQueryParam( 'date-start' );
		const endDateParam = getQueryParam( 'date-end' );



		if ( startDateParam && endDateParam ) {
			const startDate = parseDate( startDateParam );
			const endDate = parseDate( endDateParam );

			if ( startDate.isValid() && endDate.isValid() ) {
				// Set the date range on the daterangepicker
				$( inputElement ).data( 'daterangepicker' ).setStartDate( startDate );
				$( inputElement ).data( 'daterangepicker' ).setEndDate( endDate );

				// Set the date fields
				startDateField.value = startDate.format( 'YYYY-MM-DD' );
				endDateField.value = endDate.format( 'YYYY-MM-DD' );

				// Update the custom date query
				dateQuery = [
					{ after: startDate.format( 'YYYY-MM-DD' ) },
					{ before: endDate.format( 'YYYY-MM-DD' ) },
				];
				console.log( 'Initialized dateQuery from URL:', dateQuery );
			}
		}
	};

	// Update picker position
	const updatePickerPosition = () => {
		const daterangepickerElement = $( inputElement ).data( 'daterangepicker' ).container;
		const currentTop = parseInt( daterangepickerElement.css( 'top' ), 10 );
		const newTop = currentTop - 30;
		daterangepickerElement.css( 'top', `${ newTop }px` );
	};

	// Update filter with selected date range
	const updateFilter = () => {
		const dateRangePicker = $( inputElement ).data( 'daterangepicker' );

		if ( ! dateRangePicker ) {
			return;
		}

		const startDate = dateRangePicker.startDate.format( 'YYYY-MM-DD' );
		const endDate = dateRangePicker.endDate.format( 'YYYY-MM-DD' );

		dateQuery = [];

		if ( startDate ) {
			dateQuery.push( { after: startDate } );
			startDateField.value = startDate;
		}
		if ( endDate ) {
			dateQuery.push( { before: endDate } );
			endDateField.value = endDate;
		}

		dateQuery = dateQuery.length > 0 ? { relation: 'AND', ...dateQuery } : undefined;

		// Update the input value to show the selected date range
		inputElement.value = dateRangePicker.chosenLabel;

		console.log( 'Updated dateQuery:', dateQuery );
	};

	// Clear the filter
	const clearFilter = () => {
		dateQuery = undefined;

		const daterangepicker = $( inputElement ).data( 'daterangepicker' );
		daterangepicker.setStartDate( moment() );
		daterangepicker.setEndDate( moment() );

		startDateField.value = '';
		endDateField.value = '';

		inputElement.value = 'Date Range';

		console.log( 'Cleared dateQuery:', dateQuery );
	};

	// Initialize the date picker
	$( inputElement ).daterangepicker( {
		locale: {
			cancelLabel: 'Clear',
		},
		ranges: {
			Today: [ moment(), moment() ],
			Yesterday: [ moment().subtract( 1, 'days' ), moment().subtract( 1, 'days' ) ],
			'Last 7 Days': [ moment().subtract( 6, 'days' ), moment() ],
			'Last 30 Days': [ moment().subtract( 29, 'days' ), moment() ],
			'This Month': [ moment().startOf( 'month' ), moment().endOf( 'month' ) ],
			'Last Month': [ moment().subtract( 1, 'month' ).startOf( 'month' ), moment().subtract( 1, 'month' ).endOf( 'month' ) ],
		},
		autoUpdateInput: false,
	} );

	$( inputElement ).on( 'apply.daterangepicker', updateFilter );
	$( inputElement ).on( 'show.daterangepicker', updatePickerPosition );
	$( inputElement ).on( 'cancel.daterangepicker', clearFilter );

	// Initialize the date range filter from URL query parameters
	initializeDateRangeFromQueryParams();

	// Set initial placeholder value
	inputElement.value = 'Date Range';
} );

