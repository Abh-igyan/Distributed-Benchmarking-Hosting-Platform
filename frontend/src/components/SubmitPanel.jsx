function SubmitPanel({
  error,
  file,
  form,
  onChange,
  onFileChange,
  onSubmit,
  uploading,
}) {
  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">New run</p>
          <h3>Submit matching engine package</h3>
        </div>
        <span className="section-tag">ZIP only</span>
      </div>

      <form className="submit-grid" onSubmit={onSubmit}>
        <label className="field">
          <span>Contestant or team</span>
          <input
            name="contestantName"
            onChange={onChange}
            placeholder="Team Alpha"
            type="text"
            value={form.contestantName}
          />
        </label>

        <label className="field">
          <span>Language</span>
          <select name="language" onChange={onChange} value={form.language}>
            <option>Python</option>
            <option>C++</option>
            <option>Go</option>
            <option>Java</option>
            <option>Other</option>
          </select>
        </label>

        <label className="file-drop">
          <span className="file-drop__title">Submission artifact</span>
          <span className="file-drop__name">{file ? file.name : "Choose a .zip file"}</span>
          <input accept=".zip" onChange={onFileChange} type="file" />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="form-actions">
          <button className="button button--primary" disabled={!file || uploading} type="submit">
            {uploading ? "Uploading" : "Submit package"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default SubmitPanel;
