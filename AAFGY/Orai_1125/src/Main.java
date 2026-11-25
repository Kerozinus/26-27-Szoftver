class Tanulo{
    String nev;
    int eletkor;
    Tanulo(String nev, int eletkor){
        this.nev = nev;
        this.eletkor = eletkor;
    }
    void bemutatkozas(){
        System.out.println("Nevem: "+nev);
        System.out.println("Életkorom: "+eletkor);
    }
}
public class Main {
    public static void main(String[] args) {
        Tanulo tanulo1 = new Tanulo("Balogh András",18);
        Tanulo tanulo2 = new Tanulo("Balogh Henrik Norbert",18);
        Tanulo tanulo3 = new Tanulo("Bodrogi Balázs Áron",18);
        Tanulo tanulo4 = new Tanulo("Gombos Vendel Vencel",18);
        Tanulo tanulo5 = new Tanulo("Gulyás János",18);
        Tanulo tanulo6 = new Tanulo("Ignáth Benjámin",18);
        Tanulo tanulo7 = new Tanulo("Iván Bence",18);
        Tanulo tanulo8 = new Tanulo("Karsai Réka Teodóra",18);
        Tanulo tanulo9 = new Tanulo("Ródé Lilien Hanna",18);
        Tanulo tanulo10 = new Tanulo("Magyari Bálint",18);
        Tanulo tanulo11 = new Tanulo("Mudris Balázs",18);
        Tanulo tanulo12 = new Tanulo("Nagy Hunor Ákos",18);
        Tanulo tanulo13 = new Tanulo("Ramecz Dávid",18);
        Tanulo tanulo14 = new Tanulo("Kovács Roxána",18);
        Tanulo tanulo15 = new Tanulo("Ruskó Regina Etelka",18);
        Tanulo tanulo16 = new Tanulo("Szabó Zsolt Kristóf",18);
        Tanulo tanulo17 = new Tanulo("Szabó Zsombor Márk",18);
        Tanulo tanulo18 = new Tanulo("Szilágyi Kristóf István",18);
        Tanulo tanulo19 = new Tanulo("Terebesi Márk Lóránt",18);
        Tanulo tanulo20 = new Tanulo("Zámbó Krisztofer",18);
        tanulo1.bemutatkozas();
        tanulo2.bemutatkozas();
        tanulo3.bemutatkozas();
        tanulo4.bemutatkozas();
        tanulo5.bemutatkozas();
        tanulo6.bemutatkozas();
        tanulo7.bemutatkozas();
        tanulo8.bemutatkozas();
        tanulo9.bemutatkozas();
        tanulo10.bemutatkozas();
        tanulo11.bemutatkozas();
        tanulo12.bemutatkozas();
        tanulo13.bemutatkozas();
        tanulo14.bemutatkozas();
        tanulo15.bemutatkozas();
        tanulo16.bemutatkozas();
        tanulo17.bemutatkozas();
        tanulo18.bemutatkozas();
        tanulo19.bemutatkozas();
        tanulo20.bemutatkozas();
    }
}