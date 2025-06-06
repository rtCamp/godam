/**
 * Media Date Range Filter - List View
 *
 * This file implements the date range filter for the media list view.
 * It functions similarly to the grid-view filter defined in `media-date-range-filter.js`
 * but is implemented here without Backbone.js dependencies.
 */

/* global jQuery, moment */

const $ = jQuery;

class MediaDateRangeListViewFilter {
	constructor( inputId, startDateId, endDateId ) {
		this.inputElement = document.getElementById( inputId );
		this.startDateField = document.getElementById( startDateId );
		this.endDateField = document.getElementById( endDateId );
		this.dateQuery = undefined;

		if ( ! this.inputElement || ! this.startDateField || ! this.endDateField ) {
			return;
		}

		// Set default text if input is empty
		if ( ! this.inputElement.value ) {
			this.inputElement.value = 'Date Range';
		}

		this.initializeDatePicker();
		this.initializeDateRangeFromQueryParams();
	}

	getQueryParam( param ) {
		const urlParams = new URLSearchParams( window.location.search );
		return urlParams.get( param );
	}

	parseDate( dateString ) {
		return moment( dateString, 'YYYY-MM-DD', true );
	}

	initializeDateRangeFromQueryParams() {
		const startDateParam = this.getQueryParam( 'date-start' );
		const endDateParam = this.getQueryParam( 'date-end' );

		if ( startDateParam && endDateParam ) {
			const startDate = this.parseDate( startDateParam );
			const endDate = this.parseDate( endDateParam );

			if ( startDate.isValid() && endDate.isValid() ) {
				$( this.inputElement ).data( 'daterangepicker' ).setStartDate( startDate );
				$( this.inputElement ).data( 'daterangepicker' ).setEndDate( endDate );
				this.startDateField.value = startDate.format( 'YYYY-MM-DD' );
				this.endDateField.value = endDate.format( 'YYYY-MM-DD' );

				this.dateQuery = {
					relation: 'AND',
					after: startDate.format( 'YYYY-MM-DD' ),
					before: endDate.format( 'YYYY-MM-DD' ),
				};
			}
		}
	}

	updatePickerPosition() {
		const daterangepickerElement = $( this.inputElement ).data( 'daterangepicker' ).container;
		const currentTop = parseInt( daterangepickerElement.css( 'top' ), 10 );
		daterangepickerElement.css( 'top', `${ currentTop - 30 }px` );
	}

	updateFilter() {
		const dateRangePicker = $( this.inputElement ).data( 'daterangepicker' );
		if ( ! dateRangePicker ) {
			return;
		}

		const startDate = dateRangePicker.startDate.format( 'YYYY-MM-DD' );
		const endDate = dateRangePicker.endDate.format( 'YYYY-MM-DD' );

		this.dateQuery = {
			relation: 'AND',
			after: startDate,
			before: endDate,
		};

		this.startDateField.value = startDate;
		this.endDateField.value = endDate;
		this.inputElement.value = dateRangePicker.chosenLabel;
	}

	clearFilter() {
		this.dateQuery = undefined;
		const daterangepicker = $( this.inputElement ).data( 'daterangepicker' );
		daterangepicker.setStartDate( moment() );
		daterangepicker.setEndDate( moment() );
		this.startDateField.value = '';
		this.endDateField.value = '';
		this.inputElement.value = 'Date Range';
	}

	initializeDatePicker() {
		$( this.inputElement ).daterangepicker( {
			locale: { cancelLabel: 'Clear' },
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

		const rangesContainer = $( this.inputElement ).data( 'daterangepicker' ).container.find( '.ranges' );

		// Create "Clear" button
		const clearButton = $( '<button>' )
			.text( 'Clear' )
			.addClass( 'btn btn-sm btn-light daterangepicker-clear' )
			.css( {
				width: '140px',
				padding: '8px',
				textAlign: 'center',
				background: '#f8f9fa',
				border: '1px solid #ddd',
				cursor: 'pointer',
				fontSize: '12px',
				fontWeight: '600',
			} )
			.on( 'click', () => {
				this.clearFilter();
				$( this.inputElement ).data( 'daterangepicker' ).hide();
			} );

		// Append "Clear" button inside the main dropdown
		rangesContainer.append( clearButton );
		$( this.inputElement ).on( 'apply.daterangepicker', this.updateFilter.bind( this ) );
		$( this.inputElement ).on( 'show.daterangepicker', this.updatePickerPosition.bind( this ) );
		$( this.inputElement ).on( 'cancel.daterangepicker', this.clearFilter.bind( this ) );
	}
}

export default MediaDateRangeListViewFilter;

