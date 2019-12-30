#!/bin/bash
set -e

data_dir="$1"
pages_dir="$2"

forms_dir="ops/forms"
fields_dir="ops/fields"
mappings_dir="src/mappings"

page_number=0

forms="`cat ops/sources.json | jq '.data | sort_by(.order) | map(.name)' | tr -d ' ,"[]' | tr '\n\r' ' '`"
mkdir -p $pages_dir

# This is the order in which forms will be combined into the final tax return
for form in $forms
do
  echo; echo "Compiling form: $form"
  for page in `find $data_dir -maxdepth 1 -type f -name "${form}.json" -or -name "${form}_*.json" | sort`
  do
    echo "  page: $page"
    page="`basename ${page%.json}`"
    page_number=$(( ${page_number#0} + 1 ))
    if [[ "$page_number" -lt "10" ]]
    then page_number="0$page_number"
    fi
    json_data="$data_dir/$page.json"
    fields="$fields_dir/$form.fields"
    mappings="$mappings_dir/$form.json"
    fdf_data="$data_dir/$page.fdf"
    empty_form="$forms_dir/$form.pdf"
    filled_form="$pages_dir/${page_number}_$page.pdf"

    echo "  - python ops/fill-form.py $json_data $fields $mappings $fdf_data"
    python ops/fill-form.py $json_data $fields $mappings $fdf_data

    echo "  - pdftk $empty_form fill_form $fdf_data output $filled_form flatten"
    pdftk $empty_form fill_form $fdf_data output $filled_form flatten

  done
done

all_pages="`find $pages_dir -type f -name "*.pdf" | sort`"
attachments="`find docs/attachments -maxdepth 1 -type f -name "w2*.pdf" | sort`"
echo; echo "pdftk $all_pages $attachments cat output build/tax-return.pdf"
pdftk $all_pages $attachments cat output build/tax-return.pdf
echo
