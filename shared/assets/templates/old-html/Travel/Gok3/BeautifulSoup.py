from bs4 import BeautifulSoup
import os

# List of HTML files to modify
html_files = [
    "contact.html",
    "features.html",
    "excursions_details.html",
    "index.html",
    "trip_planning_form.html",
    "workflow_confirmation.html"
]

# CSS to add for the navigation bar icon and flex container
css_to_add = """
    /* Style for the navigation bar icon */
    .nav-icon {
      height: 30px; /* Adjust the height to fit the navigation bar */
      width: auto;
      margin-right: 8px; /* Space between the image and the text */
    }
    /* Flex container for the image and text */
    .nav-brand {
      display: flex;
      align-items: center;
    }
"""

# Process each HTML file
for html_file in html_files:
    # Check if the file exists
    if not os.path.exists(html_file):
        print(f"File {html_file} not found, skipping...")
        continue

    # Read the HTML file
    with open(html_file, "r", encoding="utf-8") as file:
        soup = BeautifulSoup(file, "html.parser")

    # Find the navigation bar's h1 element with "Voyage Genie"
    nav_h1 = soup.find("h1", class_="text-2xl font-bold", string="Voyage Genie")
    if not nav_h1:
        print(f"Could not find 'Voyage Genie' h1 in {html_file}, skipping...")
        continue

    # Create the new structure: <a> wrapping an <img> and the existing <h1>
    new_a_tag = soup.new_tag("a", href="index.html", **{"class": "nav-brand"}, attrs={"aria-label": "Go to Home"})
    new_img_tag = soup.new_tag("img", src="nav-icon.png", alt="Voyage Genie Icon", **{"class": "nav-icon"})

    # Insert the image before the h1 text, and wrap both in the <a> tag
    nav_h1_parent = nav_h1.parent
    nav_h1.extract()  # Remove the h1 from its current position
    new_a_tag.append(new_img_tag)  # Add the image
    new_a_tag.append(nav_h1)  # Add the h1 back
    nav_h1_parent.append(new_a_tag)  # Add the new <a> tag to the parent

    # Find or create the <style> tag in the <head>
    head_tag = soup.head
    style_tag = head_tag.find("style")
    if not style_tag:
        style_tag = soup.new_tag("style")
        head_tag.append(style_tag)
    
    # Append the new CSS to the <style> tag
    style_tag.string = (style_tag.string or "") + css_to_add

    # Write the modified HTML back to the file
    with open(html_file, "w", encoding="utf-8") as file:
        file.write(str(soup))

    print(f"Successfully updated {html_file}")

print("All files processed!")