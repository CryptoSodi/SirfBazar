# Merchant product entry: interaction and states

The existing merchant drawer and visual tokens remain the baseline. The form is grouped in the order a shopkeeper thinks about an item: identity, photo, selling details, then optional notes. The image area shows the selected file or URL before saving; it is not a separate catalog-approval step.

- **Empty:** visible labels, example name/price, a product-image placeholder, and a short statement that the product appears in this shop immediately.
- **Photo selected:** preview the file locally without uploading until Save. Replacing or removing the file updates the preview. An image URL is the alternative input, not a simultaneous source.
- **Image failed:** show the placeholder and an actionable message; do not leave a broken-image icon or prevent saving without a photo.
- **Saving:** prevent duplicate submits. Upload the optional photo first, then create product plus listing in one server operation. Close only after the server confirms the listing.
- **Saved:** the new listing appears at the top of My shop listings with its thumbnail. A toast explains that only sharing to the master catalogue awaits review.
- **Error:** preserve all entered fields and the selected file so the merchant can retry.

At narrow widths, pairs become a single column and the image preview stays within the drawer. Native file/input controls and labelled buttons keep keyboard and screen-reader paths intact.
