import './AuthorshipNote.css'

/**
 * Every page that shows prose carries this so the disclosure is never more
 * than one screen away from the words it describes.
 */
export function AuthorshipNote() {
  return (
    <p className="authorship-note">
      The bio and blog articles on this site are typed exclusively by hand without the use of large-language models to draft or edit the
      words. LLMs did help build the site, do research, and implement the projects it links to.
    </p>
  )
}
