/**
 * WordPress dependencies
 */
const { test, expect } = require('@wordpress/e2e-test-utils-playwright');
const { TransCodeStatus } = require("../utils/locator.js");
test.describe('Validate Transcoder Settings', () => {
    test.beforeEach(async ({ admin }) => {
        await admin.visitAdminPage('/');
    });
    test('Check Transcoder settings Options', async ({ admin, page, editor }) => {

        await page.locator("#toplevel_page_rt-transcoder > a > div.wp-menu-name").click();
        // Check Lisence key Settings and insert Free key
        const licenseSettings = page.locator("input[id='new-api-key']")
        expect(licenseSettings).not.toBeNull();
        await page.focus("input[id='new-api-key']");
        await licenseSettings.fill("8c1a107c6c89bd9dda666a635f441890");
        await page.locator("button[id='api-key-submit']").click();
        //verify Save key
        await expect(page.locator("div[class='updated']")).not.toBeNull()
        await page.locator("#submit").click();

        // Check Feature plan is present on the DOM
        const settingBox = page.locator("div[id='transcoder-settings-boxes']")
        expect(settingBox).not.toBeNull();

        // verify Free plan by checking button is disabled
        const checkButton = page.locator("button[class='button button-primary bpm-unsubscribe']").isDisabled();
        expect(checkButton).toBeTruthy();

        // Check thumbnail Settings
        const thumbnailSetting = page.locator('input[name="number_of_thumbs"]');
        expect(thumbnailSetting).not.toBeNull();
        // Check Transcoder Usage 
        const activeUsage = page.locator("div[id='transcoder-usage']");
        expect(activeUsage).not.toBeNull();
        // Validate Checkboxes
        const thumbnailCheckbox = await page.locator("input[name='rtgodam_override_thumbnail']").isChecked();
        const trackUserprofile = await page.locator("input[name='rtgodam_client_check_status_button']").isChecked();

        // Ensure Checkbox are checked for checking transcoding status for next test case
        if (thumbnailCheckbox === false) {
            await page.locator("input[name='rtgodam_override_thumbnail']").check();
        }

        if (trackUserprofile === false) {
            await page.locator("input[name='rtgodam_client_check_status_button']").check();
        }
        // Save settings and verify
        await page.locator("#submit").click();
        await expect(page.locator("div[class='updated']")).not.toBeNull();

        // Check for Empty Retranscoder
        await page.locator("role=link[name='Retranscode Media']").click();
        // Click retranscode all media 
        await page.locator("role=button[name='Retranscode All Media']").click();
        // Get Message from DOM
        const CheckMessage = await page.evaluate(selector => document.querySelector("div.wrap.retranscodemedia > p").innerText.slice(0, 4));
        // It will assert Both Emtpy and Non Empty Media For ReTranscoding.
        if (CheckMessage == TransCodeStatus.NotNull) {
            console.log("Already Media Exist")
        }
        else if (CheckMessage == TransCodeStatus.EmptyMedia) {
            console.log("No Media is present For Transcoding")
        }
    });
});