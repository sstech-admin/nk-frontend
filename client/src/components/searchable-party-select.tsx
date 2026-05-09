import { SearchableSelect } from "@/components/searchable-select";

interface PartyOption {
  id: string;
  name: string;
  gstNo?: string | null;
}

interface SearchablePartySelectProps {
  parties: PartyOption[];
  value: string;
  onChange: (partyName: string) => void;
  onAddNew?: () => void;
  placeholder?: string;
}

export function SearchablePartySelect({
  parties,
  value,
  onChange,
  onAddNew,
  placeholder = "Select Party",
}: SearchablePartySelectProps) {
  const options = parties.map((p) => ({
    id: p.id,
    label: p.name,
    sublabel: p.gstNo ? `GST: ${p.gstNo}` : undefined,
  }));

  return (
    <SearchableSelect
      options={options}
      value={value}
      onChange={onChange}
      onAddNew={onAddNew}
      addNewLabel="Add New Party"
      placeholder={placeholder}
      searchPlaceholder="Search by name or GST..."
      noResultsText="No parties found"
      testIdPrefix="party"
    />
  );
}
